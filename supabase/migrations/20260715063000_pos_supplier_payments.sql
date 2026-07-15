-- POS supplier payments: session cash link + cashier-opt-in permission

ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES cashier_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payments_session
  ON supplier_payments(session_id)
  WHERE session_id IS NOT NULL;

INSERT INTO permissions (key, label, description, group_name) VALUES
  (
    'supplier_payment_record',
    'Record supplier payments',
    'Record supplier account payments from POS or suppliers',
    'inventory'
  )
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  r_org RECORD;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'owner', 'supplier_payment_record'),
      (r_org.id, 'manager', 'supplier_payment_record')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Cashiers need INSERT when permission is granted (not privileged by default).
DROP POLICY IF EXISTS supplier_payments_insert ON supplier_payments;
CREATE POLICY supplier_payments_insert ON supplier_payments FOR INSERT
  WITH CHECK (
    has_store_access(store_id)
    AND (
      is_privileged_role()
      OR has_permission('supplier_payment_record')
    )
  );

DROP POLICY IF EXISTS supplier_payments_update ON supplier_payments;
CREATE POLICY supplier_payments_update ON supplier_payments FOR UPDATE
  USING (
    has_store_access(store_id)
    AND (
      is_privileged_role()
      OR has_permission('supplier_payment_record')
    )
  )
  WITH CHECK (
    has_store_access(store_id)
    AND (
      is_privileged_role()
      OR has_permission('supplier_payment_record')
    )
  );
