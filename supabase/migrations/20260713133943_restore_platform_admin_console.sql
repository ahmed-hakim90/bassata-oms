-- S01 / ADR-001: Restore platform control plane AFTER cafeflow legacy cleanup.
-- Source shape: 039_platform_admin_console.sql
-- Fix: platform_organization_data_size counts purchase_invoices via stores
--      (purchase_invoices has no org_id column).
-- Do NOT remove or rewrite 20260612193243_cafeflow_legacy_cleanup.sql.

-- ---------------------------------------------------------------------------
-- organizations.status (idempotent; may already exist from 039)
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'suspended'));

-- ---------------------------------------------------------------------------
-- platform_* tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_company_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  org_name TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  revoked_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_company_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS platform_company_invites_owner_email_idx
  ON platform_company_invites (lower(owner_email));

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_company_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admins_no_direct ON platform_admins;
CREATE POLICY platform_admins_no_direct ON platform_admins
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS platform_company_invites_no_direct ON platform_company_invites;
CREATE POLICY platform_company_invites_no_direct ON platform_company_invites
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS platform_audit_logs_no_direct ON platform_audit_logs;
CREATE POLICY platform_audit_logs_no_direct ON platform_audit_logs
  FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Tenant size RPC — purchases via stores join (no purchase_invoices.org_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_organization_data_size(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_store_count BIGINT := 0;
  v_user_count BIGINT := 0;
  v_product_count BIGINT := 0;
  v_customer_count BIGINT := 0;
  v_order_count BIGINT := 0;
  v_expense_count BIGINT := 0;
  v_purchase_count BIGINT := 0;
  v_movement_count BIGINT := 0;
  v_audit_count BIGINT := 0;
  v_database_bytes BIGINT := 0;
BEGIN
  SELECT count(*) INTO v_store_count FROM stores WHERE org_id = p_org_id;
  SELECT count(*) INTO v_user_count FROM users WHERE org_id = p_org_id;
  SELECT count(*) INTO v_product_count FROM products WHERE org_id = p_org_id;
  SELECT count(*) INTO v_customer_count FROM customers WHERE org_id = p_org_id;
  SELECT count(*) INTO v_order_count
    FROM orders o JOIN stores s ON s.id = o.store_id
    WHERE s.org_id = p_org_id;
  SELECT count(*) INTO v_expense_count
    FROM expenses e JOIN stores s ON s.id = e.store_id
    WHERE s.org_id = p_org_id;
  SELECT count(*) INTO v_purchase_count
    FROM purchase_invoices pi JOIN stores s ON s.id = pi.store_id
    WHERE s.org_id = p_org_id;
  SELECT count(*) INTO v_movement_count
    FROM inventory_movements m JOIN stores s ON s.id = m.store_id
    WHERE s.org_id = p_org_id;
  SELECT count(*) INTO v_audit_count FROM audit_logs WHERE org_id = p_org_id;

  v_database_bytes :=
    (v_store_count * 2048) +
    (v_user_count * 2048) +
    (v_product_count * 4096) +
    (v_customer_count * 2048) +
    (v_order_count * 6144) +
    (v_expense_count * 2048) +
    (v_purchase_count * 4096) +
    (v_movement_count * 2048) +
    (v_audit_count * 1024);

  RETURN jsonb_build_object(
    'store_count', v_store_count,
    'user_count', v_user_count,
    'product_count', v_product_count,
    'customer_count', v_customer_count,
    'order_count', v_order_count,
    'expense_count', v_expense_count,
    'purchase_count', v_purchase_count,
    'inventory_movement_count', v_movement_count,
    'audit_log_count', v_audit_count,
    'database_bytes', v_database_bytes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE ALL ON FUNCTION platform_organization_data_size(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_organization_data_size(UUID) TO service_role;
