-- P0 hardening: RLS coverage for generalized inventory tables + append-only audit logs

-- ---------------------------------------------------------------------------
-- RLS enablement for tables introduced in 036
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batch_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_serial_numbers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- inventory_units (org-scoped)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_units_select ON inventory_units;
DROP POLICY IF EXISTS inventory_units_mutate ON inventory_units;

CREATE POLICY inventory_units_select ON inventory_units FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY inventory_units_mutate ON inventory_units FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

-- ---------------------------------------------------------------------------
-- unit_conversions (org-scoped)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS unit_conversions_select ON unit_conversions;
DROP POLICY IF EXISTS unit_conversions_mutate ON unit_conversions;

CREATE POLICY unit_conversions_select ON unit_conversions FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY unit_conversions_mutate ON unit_conversions FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

-- ---------------------------------------------------------------------------
-- inventory_batches (org + store scoped)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_batches_select ON inventory_batches;
DROP POLICY IF EXISTS inventory_batches_mutate ON inventory_batches;

CREATE POLICY inventory_batches_select ON inventory_batches FOR SELECT
  USING (
    org_id = auth_org_id()
    AND has_store_access(store_id)
  );

CREATE POLICY inventory_batches_mutate ON inventory_batches FOR ALL
  USING (
    org_id = auth_org_id()
    AND has_store_access(store_id)
    AND can_mutate_inventory_ops()
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND has_store_access(store_id)
    AND can_mutate_inventory_ops()
  );

-- ---------------------------------------------------------------------------
-- inventory_batch_movements (through accessible batch parent)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_batch_movements_select ON inventory_batch_movements;
DROP POLICY IF EXISTS inventory_batch_movements_mutate ON inventory_batch_movements;

CREATE POLICY inventory_batch_movements_select ON inventory_batch_movements FOR SELECT
  USING (
    org_id = auth_org_id()
    AND batch_id IN (
      SELECT b.id
      FROM inventory_batches b
      WHERE b.org_id = auth_org_id()
        AND has_store_access(b.store_id)
    )
  );

CREATE POLICY inventory_batch_movements_mutate ON inventory_batch_movements FOR ALL
  USING (
    org_id = auth_org_id()
    AND can_mutate_inventory_ops()
    AND batch_id IN (
      SELECT b.id
      FROM inventory_batches b
      WHERE b.org_id = auth_org_id()
        AND has_store_access(b.store_id)
    )
  )
  WITH CHECK (
    org_id = auth_org_id()
    AND can_mutate_inventory_ops()
    AND batch_id IN (
      SELECT b.id
      FROM inventory_batches b
      WHERE b.org_id = auth_org_id()
        AND has_store_access(b.store_id)
    )
  );

-- ---------------------------------------------------------------------------
-- product_serial_numbers (org scoped, privileged mutation)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS product_serial_numbers_select ON product_serial_numbers;
DROP POLICY IF EXISTS product_serial_numbers_mutate ON product_serial_numbers;

CREATE POLICY product_serial_numbers_select ON product_serial_numbers FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY product_serial_numbers_mutate ON product_serial_numbers FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

-- ---------------------------------------------------------------------------
-- audit_logs append-only (UPDATE/DELETE blocked; INSERT path remains RPC-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_update_deny ON audit_logs;
DROP POLICY IF EXISTS audit_delete_deny ON audit_logs;

CREATE POLICY audit_update_deny ON audit_logs FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY audit_delete_deny ON audit_logs FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'audit_logs is append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_logs_mutation();
