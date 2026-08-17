-- Org HQ + per-store cash treasuries with append-only ledger.
-- Cashier amanah vaults stay separate; admin withdraw deposits into a treasury.

CREATE TYPE cash_treasury_kind AS ENUM ('hq', 'store');

CREATE TYPE cash_treasury_entry_type AS ENUM (
  'transfer_out',
  'transfer_in',
  'cashier_collect',
  'expense_payout',
  'collection_deposit',
  'supplier_payout',
  'period_sweep'
);

CREATE TABLE IF NOT EXISTS cash_treasuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind cash_treasury_kind NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cash_treasuries_kind_store_ck CHECK (
    (kind = 'hq' AND store_id IS NULL)
    OR (kind = 'store' AND store_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_treasuries_hq_per_org
  ON cash_treasuries (org_id)
  WHERE kind = 'hq';

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_treasuries_store_per_org
  ON cash_treasuries (org_id, store_id)
  WHERE kind = 'store';

CREATE INDEX IF NOT EXISTS idx_cash_treasuries_org
  ON cash_treasuries (org_id, kind);

CREATE TABLE IF NOT EXISTS cash_treasury_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  treasury_id UUID NOT NULL REFERENCES cash_treasuries(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  entry_type cash_treasury_entry_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  counterpart_treasury_id UUID REFERENCES cash_treasuries(id) ON DELETE SET NULL,
  session_id UUID REFERENCES cashier_sessions(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  customer_payment_id UUID REFERENCES customer_payments(id) ON DELETE SET NULL,
  supplier_payment_id UUID REFERENCES supplier_payments(id) ON DELETE SET NULL,
  period_id UUID REFERENCES monthly_closes(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_treasury_ledger_treasury
  ON cash_treasury_ledger (treasury_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_treasury_ledger_org
  ON cash_treasury_ledger (org_id, created_at DESC);

-- One period sweep per store treasury + closed period.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_treasury_period_sweep
  ON cash_treasury_ledger (org_id, treasury_id, period_id)
  WHERE entry_type = 'period_sweep' AND period_id IS NOT NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES cash_treasuries(id) ON DELETE SET NULL;

ALTER TABLE customer_payments
  ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES cash_treasuries(id) ON DELETE SET NULL;

ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES cash_treasuries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_treasury ON expenses (treasury_id)
  WHERE treasury_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_payments_treasury ON customer_payments (treasury_id)
  WHERE treasury_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_treasury ON supplier_payments (treasury_id)
  WHERE treasury_id IS NOT NULL;

ALTER TABLE cash_treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_treasury_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_treasuries_select ON cash_treasuries;
CREATE POLICY cash_treasuries_select ON cash_treasuries FOR SELECT
  USING (
    org_id = auth_org_id()
    AND (
      is_privileged_role()
      OR (kind = 'store' AND store_id IS NOT NULL AND has_store_access(store_id))
    )
  );

DROP POLICY IF EXISTS cash_treasury_ledger_select ON cash_treasury_ledger;
CREATE POLICY cash_treasury_ledger_select ON cash_treasury_ledger FOR SELECT
  USING (
    org_id = auth_org_id()
    AND (
      is_privileged_role()
      OR (store_id IS NOT NULL AND has_store_access(store_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Ensure helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_hq_treasury(p_org_id UUID)
RETURNS cash_treasuries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row cash_treasuries;
BEGIN
  INSERT INTO cash_treasuries (org_id, kind, store_id)
  VALUES (p_org_id, 'hq', NULL)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_row
  FROM cash_treasuries
  WHERE org_id = p_org_id AND kind = 'hq'
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Failed to ensure HQ treasury';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_store_treasury(p_org_id UUID, p_store_id UUID)
RETURNS cash_treasuries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row cash_treasuries;
BEGIN
  INSERT INTO cash_treasuries (org_id, kind, store_id)
  VALUES (p_org_id, 'store', p_store_id)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_row
  FROM cash_treasuries
  WHERE org_id = p_org_id AND kind = 'store' AND store_id = p_store_id
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Failed to ensure store treasury';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_org_treasuries()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_store RECORD;
  v_count INT := 0;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  PERFORM ensure_hq_treasury(v_org_id);
  v_count := 1;

  FOR v_store IN
    SELECT id FROM stores WHERE org_id = v_org_id
  LOOP
    PERFORM ensure_store_treasury(v_org_id, v_store.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Backfill existing orgs/stores.
DO $$
DECLARE
  r_org RECORD;
  r_store RECORD;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    PERFORM ensure_hq_treasury(r_org.id);
    FOR r_store IN SELECT id FROM stores WHERE org_id = r_org.id LOOP
      PERFORM ensure_store_treasury(r_org.id, r_store.id);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION assert_treasury_access(p_treasury cash_treasuries)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_treasury.kind = 'hq' THEN
    IF NOT is_privileged_role() THEN
      RAISE EXCEPTION 'Admin only';
    END IF;
  ELSIF p_treasury.store_id IS NULL OR NOT has_store_access(p_treasury.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION treasury_apply_delta(
  p_treasury_id UUID,
  p_entry_type cash_treasury_entry_type,
  p_amount NUMERIC,
  p_counterpart_treasury_id UUID,
  p_notes TEXT,
  p_session_id UUID DEFAULT NULL,
  p_expense_id UUID DEFAULT NULL,
  p_customer_payment_id UUID DEFAULT NULL,
  p_supplier_payment_id UUID DEFAULT NULL,
  p_period_id UUID DEFAULT NULL
)
RETURNS cash_treasuries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_row cash_treasuries;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount = 0 THEN
    RAISE EXCEPTION 'Amount must not be zero';
  END IF;

  SELECT * INTO v_row
  FROM cash_treasuries
  WHERE id = p_treasury_id AND org_id = v_org_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;

  IF v_row.balance + v_amount < 0 THEN
    RAISE EXCEPTION 'رصيد الخزينة غير كافٍ';
  END IF;

  UPDATE cash_treasuries
  SET balance = balance + v_amount, updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  INSERT INTO cash_treasury_ledger (
    org_id, treasury_id, store_id, entry_type, amount, balance_after,
    counterpart_treasury_id, session_id, expense_id, customer_payment_id,
    supplier_payment_id, period_id, notes, created_by
  ) VALUES (
    v_org_id, v_row.id, v_row.store_id, p_entry_type, v_amount, v_row.balance,
    p_counterpart_treasury_id, p_session_id, p_expense_id, p_customer_payment_id,
    p_supplier_payment_id, p_period_id, COALESCE(NULLIF(trim(p_notes), ''), ''),
    v_user_id
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Transfer HQ <-> store (phase 1)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION treasury_transfer(
  p_from_treasury_id UUID,
  p_to_treasury_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_from cash_treasuries;
  v_to cash_treasuries;
  v_amount NUMERIC;
  v_notes TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_amount := round(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_from FROM cash_treasuries WHERE id = p_from_treasury_id AND org_id = v_org_id FOR UPDATE;
  SELECT * INTO v_to FROM cash_treasuries WHERE id = p_to_treasury_id AND org_id = v_org_id FOR UPDATE;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  IF v_from.id = v_to.id THEN
    RAISE EXCEPTION 'Cannot transfer to the same treasury';
  END IF;
  -- Phase 1: only HQ <-> store
  IF NOT (
    (v_from.kind = 'hq' AND v_to.kind = 'store')
    OR (v_from.kind = 'store' AND v_to.kind = 'hq')
  ) THEN
    RAISE EXCEPTION 'التحويل متاح بين الخزينة الرئيسية وخزينة الفرع فقط';
  END IF;

  PERFORM assert_treasury_access(v_from);
  PERFORM assert_treasury_access(v_to);

  IF v_from.store_id IS NOT NULL AND is_period_closed(v_from.store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;
  IF v_to.store_id IS NOT NULL AND is_period_closed(v_to.store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  v_notes := COALESCE(NULLIF(trim(p_notes), ''), 'تحويل بين الخزائن');

  PERFORM treasury_apply_delta(
    v_from.id, 'transfer_out', -v_amount, v_to.id, v_notes
  );
  PERFORM treasury_apply_delta(
    v_to.id, 'transfer_in', v_amount, v_from.id, v_notes
  );

  PERFORM insert_audit_log(
    'cash_treasury.transfer',
    'cash_treasury',
    v_from.id::text,
    COALESCE(v_from.store_id, v_to.store_id),
    jsonb_build_object(
      'from_treasury_id', v_from.id,
      'to_treasury_id', v_to.id,
      'amount', v_amount,
      'notes', v_notes
    )
  );

  RETURN v_to.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Post operational cash in/out
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION treasury_post_expense(
  p_treasury_id UUID,
  p_expense_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row cash_treasuries;
  v_expense expenses;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT e.* INTO v_expense
  FROM expenses e
  JOIN stores s ON s.id = e.store_id
  WHERE e.id = p_expense_id AND s.org_id = v_org_id;
  IF v_expense.id IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  IF v_expense.session_id IS NOT NULL OR v_expense.expense_source = 'session_cash' THEN
    RAISE EXCEPTION 'مصروف الجلسة بيتخصم من الدرج مش من الخزينة';
  END IF;
  IF v_expense.payment_method IS DISTINCT FROM 'cash' THEN
    RAISE EXCEPTION 'خزينة المصروف للنقدي فقط';
  END IF;

  v_amount := round(COALESCE(p_amount, v_expense.amount)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = p_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  IF EXISTS (
    SELECT 1 FROM cash_treasury_ledger
    WHERE expense_id = p_expense_id AND entry_type = 'expense_payout'
  ) THEN
    RETURN v_row.id;
  END IF;

  PERFORM treasury_apply_delta(
    v_row.id, 'expense_payout', -v_amount, NULL,
    COALESCE(NULLIF(trim(p_notes), ''), 'صرف مصروف من الخزينة'),
    NULL, p_expense_id, NULL, NULL, NULL
  );

  UPDATE expenses SET treasury_id = v_row.id WHERE id = p_expense_id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION treasury_post_collection(
  p_treasury_id UUID,
  p_customer_payment_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row cash_treasuries;
  v_payment customer_payments;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_payment
  FROM customer_payments
  WHERE id = p_customer_payment_id AND org_id = v_org_id;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payment is voided';
  END IF;
  IF v_payment.payment_method IS DISTINCT FROM 'cash' THEN
    RAISE EXCEPTION 'إيداع التحصيل في الخزينة للنقدي فقط';
  END IF;

  v_amount := round(COALESCE(p_amount, v_payment.amount)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = p_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  IF EXISTS (
    SELECT 1 FROM cash_treasury_ledger
    WHERE customer_payment_id = p_customer_payment_id AND entry_type = 'collection_deposit'
  ) THEN
    RETURN v_row.id;
  END IF;

  PERFORM treasury_apply_delta(
    v_row.id, 'collection_deposit', v_amount, NULL,
    COALESCE(NULLIF(trim(p_notes), ''), 'تحصيل نقدي للخزينة'),
    NULL, NULL, p_customer_payment_id, NULL, NULL
  );

  UPDATE customer_payments SET treasury_id = v_row.id WHERE id = p_customer_payment_id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION treasury_post_supplier_pay(
  p_treasury_id UUID,
  p_supplier_payment_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row cash_treasuries;
  v_payment supplier_payments;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_payment
  FROM supplier_payments
  WHERE id = p_supplier_payment_id AND org_id = v_org_id;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Supplier payment not found';
  END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payment is voided';
  END IF;
  IF v_payment.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'سداد المورد من الجلسة بيتخصم من الدرج مش من الخزينة';
  END IF;
  IF v_payment.payment_method IS DISTINCT FROM 'cash' THEN
    RAISE EXCEPTION 'صرف المورد من الخزينة للنقدي فقط';
  END IF;

  v_amount := round(COALESCE(p_amount, v_payment.amount)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = p_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  IF EXISTS (
    SELECT 1 FROM cash_treasury_ledger
    WHERE supplier_payment_id = p_supplier_payment_id AND entry_type = 'supplier_payout'
  ) THEN
    RETURN v_row.id;
  END IF;

  PERFORM treasury_apply_delta(
    v_row.id, 'supplier_payout', -v_amount, NULL,
    COALESCE(NULLIF(trim(p_notes), ''), 'سداد مورد من الخزينة'),
    NULL, NULL, NULL, p_supplier_payment_id, NULL
  );

  UPDATE supplier_payments SET treasury_id = v_row.id WHERE id = p_supplier_payment_id;

  RETURN v_row.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Period sweep: cashier excess -> store treasury -> HQ
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION treasury_period_sweep(
  p_store_id UUID,
  p_period_id UUID,
  p_notes TEXT DEFAULT ''
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_period monthly_closes;
  v_store cash_treasuries;
  v_hq cash_treasuries;
  v_vault RECORD;
  v_excess NUMERIC;
  v_total_collect NUMERIC := 0;
  v_sweep NUMERIC;
  v_notes TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  SELECT * INTO v_period
  FROM monthly_closes
  WHERE id = p_period_id AND org_id = v_org_id;
  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'الفترة غير موجودة';
  END IF;
  IF v_period.status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'لازم الفترة تكون مقفولة قبل سحبها للخزينة الرئيسية';
  END IF;
  IF v_period.store_id IS NOT NULL AND v_period.store_id IS DISTINCT FROM p_store_id THEN
    RAISE EXCEPTION 'الفترة مش لنفس الفرع';
  END IF;

  v_store := ensure_store_treasury(v_org_id, p_store_id);
  v_hq := ensure_hq_treasury(v_org_id);

  SELECT * INTO v_store FROM cash_treasuries WHERE id = v_store.id FOR UPDATE;
  SELECT * INTO v_hq FROM cash_treasuries WHERE id = v_hq.id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM cash_treasury_ledger
    WHERE org_id = v_org_id
      AND treasury_id = v_store.id
      AND period_id = p_period_id
      AND entry_type = 'period_sweep'
  ) THEN
    RAISE EXCEPTION 'اتسحب رصيد الفترة دي قبل كده للخزينة الرئيسية';
  END IF;

  v_notes := COALESCE(NULLIF(trim(p_notes), ''), 'سحب فترة كاملة للخزينة الرئيسية');

  FOR v_vault IN
    SELECT * FROM cashier_vaults
    WHERE org_id = v_org_id AND store_id = p_store_id
    FOR UPDATE
  LOOP
    v_excess := round(
      GREATEST(v_vault.balance - COALESCE(v_vault.pending_opening_float, 0), 0)::numeric,
      2
    );
    IF v_excess <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE cashier_vaults
    SET
      balance = balance - v_excess,
      updated_at = now()
    WHERE id = v_vault.id
    RETURNING * INTO v_vault;

    INSERT INTO cashier_vault_ledger (
      org_id, store_id, cashier_id, vault_id, entry_type,
      amount, balance_after, notes, created_by
    ) VALUES (
      v_org_id, p_store_id, v_vault.cashier_id, v_vault.id, 'admin_withdraw',
      -v_excess, v_vault.balance,
      'توريد فائض أمانة الكاشير ضمن سحب الفترة',
      v_user_id
    );

    PERFORM treasury_apply_delta(
      v_store.id, 'cashier_collect', v_excess, NULL,
      'توريد من أمانة كاشير ضمن سحب الفترة',
      NULL, NULL, NULL, NULL, p_period_id
    );

    v_total_collect := v_total_collect + v_excess;
  END LOOP;

  SELECT * INTO v_store FROM cash_treasuries WHERE id = v_store.id FOR UPDATE;
  v_sweep := round(v_store.balance::numeric, 2);
  IF v_sweep <= 0 THEN
    RAISE EXCEPTION 'مفيش رصيد في خزينة الفرع عشان يتسحب';
  END IF;

  PERFORM treasury_apply_delta(
    v_store.id, 'period_sweep', -v_sweep, v_hq.id, v_notes,
    NULL, NULL, NULL, NULL, p_period_id
  );
  PERFORM treasury_apply_delta(
    v_hq.id, 'transfer_in', v_sweep, v_store.id, v_notes,
    NULL, NULL, NULL, NULL, p_period_id
  );

  PERFORM insert_audit_log(
    'cash_treasury.period_sweep',
    'cash_treasury',
    v_store.id::text,
    p_store_id,
    jsonb_build_object(
      'period_id', p_period_id,
      'cashier_collected', v_total_collect,
      'swept_to_hq', v_sweep,
      'notes', v_notes
    )
  );

  RETURN v_sweep;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin withdraw deposits into a destination treasury (default: store)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS cashier_vault_admin_withdraw(UUID, UUID, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION cashier_vault_admin_withdraw(
  p_store_id UUID,
  p_cashier_id UUID,
  p_withdraw_amount NUMERIC,
  p_next_opening_float NUMERIC,
  p_notes TEXT DEFAULT '',
  p_destination_treasury_id UUID DEFAULT NULL
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_vault cashier_vaults;
  v_withdraw NUMERIC;
  v_next NUMERIC;
  v_dest cash_treasuries;
  v_notes TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(p_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  v_withdraw := COALESCE(p_withdraw_amount, 0);
  v_next := COALESCE(p_next_opening_float, 0);
  IF v_withdraw < 0 OR v_next < 0 THEN
    RAISE EXCEPTION 'المبالغ يجب تكون صفر أو أكبر';
  END IF;

  IF p_destination_treasury_id IS NULL THEN
    v_dest := ensure_store_treasury(v_org_id, p_store_id);
  ELSE
    SELECT * INTO v_dest
    FROM cash_treasuries
    WHERE id = p_destination_treasury_id AND org_id = v_org_id;
    IF v_dest.id IS NULL THEN
      RAISE EXCEPTION 'Treasury not found';
    END IF;
    IF v_dest.kind = 'store' AND v_dest.store_id IS DISTINCT FROM p_store_id THEN
      RAISE EXCEPTION 'خزينة الفرع لازم تكون لنفس الفرع';
    END IF;
  END IF;
  PERFORM assert_treasury_access(v_dest);

  v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE id = v_vault.id
  FOR UPDATE;

  IF v_withdraw + v_next > v_vault.balance THEN
    RAISE EXCEPTION 'السحب + رصيد بداية الوردية الجاية أكبر من رصيد الخزينة';
  END IF;

  UPDATE cashier_vaults
  SET
    balance = balance - v_withdraw,
    pending_opening_float = v_next,
    updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  v_notes := COALESCE(NULLIF(trim(p_notes), ''), 'توريد من أمانة الكاشير للخزينة');

  INSERT INTO cashier_vault_ledger (
    org_id, store_id, cashier_id, vault_id, entry_type,
    amount, balance_after, notes, created_by
  ) VALUES (
    v_org_id, p_store_id, p_cashier_id, v_vault.id, 'admin_withdraw',
    -v_withdraw, v_vault.balance, v_notes, v_user_id
  );

  IF v_withdraw > 0 THEN
    PERFORM treasury_apply_delta(
      v_dest.id, 'cashier_collect', v_withdraw, NULL, v_notes
    );
  END IF;

  PERFORM insert_audit_log(
    'cashier_vault.admin_withdraw',
    'cashier_vault',
    v_vault.id::text,
    p_store_id,
    jsonb_build_object(
      'cashier_id', p_cashier_id,
      'withdraw_amount', v_withdraw,
      'next_opening_float', v_next,
      'balance_after', v_vault.balance,
      'destination_treasury_id', v_dest.id,
      'notes', v_notes
    )
  );

  RETURN v_vault;
END;
$$;

-- Auto-create store treasury when a store is inserted.
CREATE OR REPLACE FUNCTION trg_stores_ensure_treasury()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ensure_store_treasury(NEW.org_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_ensure_treasury ON stores;
CREATE TRIGGER stores_ensure_treasury
  AFTER INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION trg_stores_ensure_treasury();

REVOKE ALL ON FUNCTION ensure_hq_treasury(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ensure_store_treasury(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION assert_treasury_access(cash_treasuries) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION treasury_apply_delta(UUID, cash_treasury_entry_type, NUMERIC, UUID, TEXT, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION ensure_org_treasuries() TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_transfer(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_post_expense(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_post_collection(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_post_supplier_pay(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_period_sweep(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cashier_vault_admin_withdraw(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;
