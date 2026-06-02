-- Customer accounts (AR), ledger, collections, payment methods wallet/credit

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit';

CREATE TYPE customer_ledger_entry_type AS ENUM (
  'credit_sale',
  'payment_received',
  'refund',
  'adjustment'
);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entry_type customer_ledger_entry_type NOT NULL,
  debit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  payment_id UUID,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method payment_method NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ
);

ALTER TABLE customer_ledger
  ADD CONSTRAINT customer_ledger_payment_fk
  FOREIGN KEY (payment_id) REFERENCES customer_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id, received_at DESC);

ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_ledger_select ON customer_ledger;
CREATE POLICY customer_ledger_select ON customer_ledger FOR SELECT
  USING (org_id = auth_org_id() AND has_store_access(store_id));

DROP POLICY IF EXISTS customer_payments_select ON customer_payments;
CREATE POLICY customer_payments_select ON customer_payments FOR SELECT
  USING (org_id = auth_org_id() AND has_store_access(store_id));

INSERT INTO permissions (key, label, description, group_name) VALUES
  ('customer_credit_sale', 'Credit sales', 'Charge customer account at POS', 'customers'),
  ('customer_payment_receive', 'Receive payments', 'Record customer account payments', 'customers'),
  ('customer_ledger_view', 'View customer ledger', 'View statements and balances', 'customers')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  r_org RECORD;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'owner', 'customer_credit_sale'),
      (r_org.id, 'owner', 'customer_payment_receive'),
      (r_org.id, 'owner', 'customer_ledger_view'),
      (r_org.id, 'manager', 'customer_credit_sale'),
      (r_org.id, 'manager', 'customer_payment_receive'),
      (r_org.id, 'manager', 'customer_ledger_view'),
      (r_org.id, 'cashier', 'customer_credit_sale'),
      (r_org.id, 'cashier', 'customer_ledger_view')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION record_customer_payment(
  p_store_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method payment_method,
  p_reference TEXT DEFAULT '',
  p_notes TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_payment_id UUID;
  v_app_user UUID;
  v_balance NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_app_user := auth_user_id();
  IF v_org_id IS NULL OR v_app_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(p_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_payment_method = 'credit' THEN
    RAISE EXCEPTION 'Cannot record collection as credit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM customers WHERE id = p_customer_id AND org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  INSERT INTO customer_payments (
    org_id, store_id, customer_id, amount, payment_method, reference, notes, created_by
  ) VALUES (
    v_org_id, p_store_id, p_customer_id, p_amount, p_payment_method,
    COALESCE(p_reference, ''), COALESCE(p_notes, ''), v_app_user
  ) RETURNING id INTO v_payment_id;

  INSERT INTO customer_ledger (
    org_id, store_id, customer_id, entry_type, debit, credit, payment_id, reference, notes, created_by
  ) VALUES (
    v_org_id, p_store_id, p_customer_id, 'payment_received', 0, p_amount, v_payment_id,
    COALESCE(p_reference, ''), COALESCE(p_notes, ''), v_app_user
  );

  UPDATE customers
  SET account_balance = GREATEST(0, account_balance - p_amount)
  WHERE id = p_customer_id AND org_id = v_org_id
  RETURNING account_balance INTO v_balance;

  PERFORM insert_audit_log(
    'customer.payment_received', 'customer_payment', v_payment_id::text, p_store_id,
    jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'balance', v_balance)
  );

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_customer_payment TO authenticated;
