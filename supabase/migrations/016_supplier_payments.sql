-- Supplier payments (AP) and purchase cancellation timestamp for statements
-- Idempotent: safe to re-run on remote via `npm run db:apply-016`

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store ON supplier_payments(store_id, paid_at DESC);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION trg_supplier_payments_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('purchases');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_payments_require_feature ON supplier_payments;
CREATE TRIGGER supplier_payments_require_feature
  BEFORE INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION trg_supplier_payments_require_feature();

DROP POLICY IF EXISTS supplier_payments_select ON supplier_payments;
CREATE POLICY supplier_payments_select ON supplier_payments FOR SELECT
  USING (has_store_access(store_id));

DROP POLICY IF EXISTS supplier_payments_insert ON supplier_payments;
CREATE POLICY supplier_payments_insert ON supplier_payments FOR INSERT
  WITH CHECK (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS supplier_payments_update ON supplier_payments;
CREATE POLICY supplier_payments_update ON supplier_payments FOR UPDATE
  USING (has_store_access(store_id) AND is_privileged_role())
  WITH CHECK (has_store_access(store_id) AND is_privileged_role());

UPDATE purchase_invoices
SET cancelled_at = COALESCE(received_at, created_at)
WHERE status = 'cancelled' AND cancelled_at IS NULL;
