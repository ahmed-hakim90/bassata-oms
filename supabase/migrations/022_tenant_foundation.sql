-- Tenant foundation: org/store fields, bootstrap RPC, org defaults seeding, storage bucket

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS stores_org_code_unique
  ON stores (org_id, code)
  WHERE code <> '';

-- ---------------------------------------------------------------------------
-- Helper: slugify store name for online menu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION slugify_store_name(p_name TEXT, p_fallback TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  v_slug := lower(trim(regexp_replace(trim(p_name), '[^a-z0-9\u0600-\u06FF]+', '-', 'g')));
  v_slug := trim(both '-' from regexp_replace(v_slug, '-+', '-', 'g'));
  IF length(v_slug) >= 2 THEN
    RETURN v_slug;
  END IF;
  RETURN COALESCE(p_fallback, 'branch-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- Seed default cost centers, permissions, and app_settings for a new org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_org_defaults(p_org_id UUID, p_store_id UUID)
RETURNS VOID AS $$
DECLARE
  cc_util UUID;
  cc_clean UUID;
  cc_pack UUID;
  cc_maint UUID;
  cc_sal UUID;
  cc_misc UUID;
BEGIN
  INSERT INTO cost_centers (org_id, name, code, type) VALUES
    (p_org_id, 'Utilities', 'UTIL', 'utilities'),
    (p_org_id, 'Cleaning', 'CLEAN', 'cleaning'),
    (p_org_id, 'Packaging', 'PACK', 'packaging'),
    (p_org_id, 'Maintenance', 'MAINT', 'maintenance'),
    (p_org_id, 'Salaries', 'SAL', 'salaries'),
    (p_org_id, 'Store Supplies', 'SUP', 'operations'),
    (p_org_id, 'Delivery', 'DEL', 'operations'),
    (p_org_id, 'Miscellaneous', 'MISC', 'other')
  ON CONFLICT (org_id, code) DO NOTHING;

  SELECT id INTO cc_util FROM cost_centers WHERE org_id = p_org_id AND code = 'UTIL';
  SELECT id INTO cc_clean FROM cost_centers WHERE org_id = p_org_id AND code = 'CLEAN';
  SELECT id INTO cc_pack FROM cost_centers WHERE org_id = p_org_id AND code = 'PACK';
  SELECT id INTO cc_maint FROM cost_centers WHERE org_id = p_org_id AND code = 'MAINT';
  SELECT id INTO cc_sal FROM cost_centers WHERE org_id = p_org_id AND code = 'SAL';
  SELECT id INTO cc_misc FROM cost_centers WHERE org_id = p_org_id AND code = 'MISC';

  INSERT INTO expense_categories (org_id, cost_center_id, name, requires_inventory_item) VALUES
    (p_org_id, cc_util, 'Electricity', false),
    (p_org_id, cc_util, 'Water', false),
    (p_org_id, cc_util, 'Internet', false),
    (p_org_id, cc_clean, 'Cleaning tools', false),
    (p_org_id, cc_clean, 'Detergents', false),
    (p_org_id, cc_clean, 'Trash bags', false),
    (p_org_id, cc_clean, 'Cleaning Service', false),
    (p_org_id, cc_pack, 'Cups', true),
    (p_org_id, cc_pack, 'Spoons', true),
    (p_org_id, cc_pack, 'Napkins', true),
    (p_org_id, cc_maint, 'Repairs', false),
    (p_org_id, cc_sal, 'Payroll', false),
    (p_org_id, cc_misc, 'Other', false),
    (p_org_id, cc_misc, 'Petty cash', false),
    (p_org_id, cc_misc, 'Supplies', false)
  ON CONFLICT (org_id, cost_center_id, name) DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT p_org_id, 'owner', key FROM permissions
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT p_org_id, 'manager', key FROM permissions
  WHERE key NOT IN ('monthly_closing_reopen', 'user_manage')
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key) VALUES
    (p_org_id, 'manager', 'expense_create'),
    (p_org_id, 'manager', 'expense_edit'),
    (p_org_id, 'manager', 'expense_delete'),
    (p_org_id, 'manager', 'expense_view_all'),
    (p_org_id, 'manager', 'expense_approve'),
    (p_org_id, 'manager', 'expense_category_manage'),
    (p_org_id, 'manager', 'session_expense_create'),
    (p_org_id, 'manager', 'purchase_from_session_create'),
    (p_org_id, 'cashier', 'pos_access'),
    (p_org_id, 'cashier', 'checkout_create'),
    (p_org_id, 'cashier', 'order_view'),
    (p_org_id, 'cashier', 'session_open'),
    (p_org_id, 'cashier', 'session_close'),
    (p_org_id, 'cashier', 'session_view'),
    (p_org_id, 'cashier', 'session_expense_create'),
    (p_org_id, 'cashier', 'purchase_from_session_create'),
    (p_org_id, 'inventory', 'product_manage'),
    (p_org_id, 'inventory', 'recipe_manage'),
    (p_org_id, 'inventory', 'inventory_view'),
    (p_org_id, 'inventory', 'purchase_manage'),
    (p_org_id, 'inventory', 'transfer_manage'),
    (p_org_id, 'inventory', 'waste_manage'),
    (p_org_id, 'inventory', 'stock_count_manage'),
    (p_org_id, 'viewer', 'order_view'),
    (p_org_id, 'viewer', 'reports_view'),
    (p_org_id, 'viewer', 'expense_view_all')
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key) VALUES
    (p_org_id, 'owner', 'session_view_all'),
    (p_org_id, 'owner', 'session_force_close'),
    (p_org_id, 'owner', 'session_settings_manage'),
    (p_org_id, 'manager', 'session_view_all'),
    (p_org_id, 'manager', 'session_force_close'),
    (p_org_id, 'manager', 'session_settings_manage')
  ON CONFLICT DO NOTHING;

  INSERT INTO warehouses (org_id, store_id, name, is_default, is_active)
  VALUES (p_org_id, p_store_id, 'Main warehouse', true, true);

  INSERT INTO app_settings (org_id, key, value) VALUES
    (p_org_id, 'feature_flags', jsonb_build_object(
      'receipt_printing', true,
      'barcode_scanner', true,
      'inventory_deduction', true,
      'loyalty', true,
      'customer_discounts', false,
      'reports', true,
      'imports_exports', true,
      'monthly_closing', true,
      'cash_drawer', false,
      'dark_mode', true,
      'tax', true,
      'payment_cash', true,
      'payment_card', true,
      'payment_other', true,
      'prevent_negative_stock', true,
      'session_expenses', true,
      'refunds', false,
      'stock_count', true,
      'transfers', true,
      'purchases', true,
      'waste', true,
      'recipes', false,
      'credit_sales', false,
      'online_menu', true,
      'online_orders', true
    )),
    (p_org_id, 'tax_rate', jsonb_build_object('rate', 0)),
    (p_org_id, 'session_settings', jsonb_build_object(
      'max_open_hours', 24,
      'warn_after_hours', 20,
      'block_sales_when_expired', true,
      'require_manager_override_for_expired_sale', true,
      'allow_manager_force_close', true
    )),
    (p_org_id, 'expense_settings', jsonb_build_object(
      'approval_required', false,
      'cashier_can_add_session_expense', true,
      'cashier_max_expense_amount', null,
      'allow_inventory_purchase_from_session', true,
      'default_cost_center_packaging', cc_pack::text,
      'default_cost_center_cleaning', cc_clean::text,
      'default_cost_center_utilities', cc_util::text,
      'prevent_expenses_in_closed_periods', true
    )),
    (p_org_id, 'receipt_footer', jsonb_build_object('text', '')),
    (p_org_id, 'receipt_header', jsonb_build_object('text', ''))
  ON CONFLICT (org_id, key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Deployment helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deployment_has_organization()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM organizations LIMIT 1);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION deployment_has_organization() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bootstrap: create org + first store + defaults (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_organization(
  p_org_name TEXT,
  p_logo_url TEXT,
  p_currency TEXT,
  p_timezone TEXT,
  p_country TEXT,
  p_store_name TEXT,
  p_store_code TEXT,
  p_store_address TEXT,
  p_store_phone TEXT,
  p_store_timezone TEXT,
  p_tax_enabled BOOLEAN,
  p_tax_rate NUMERIC,
  p_tax_inclusive BOOLEAN,
  p_receipt_header TEXT,
  p_receipt_footer TEXT,
  p_feature_flags JSONB
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_store_id UUID;
  v_menu_slug TEXT;
  v_menu_token TEXT;
  v_flags JSONB;
  cc_util UUID;
  cc_clean UUID;
  cc_pack UUID;
BEGIN
  IF (SELECT COUNT(*) FROM organizations) > 0 THEN
    RAISE EXCEPTION 'ORGANIZATION_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  v_org_id := gen_random_uuid();
  v_store_id := gen_random_uuid();
  v_menu_slug := slugify_store_name(p_store_name, 'branch-' || substr(replace(v_store_id::text, '-', ''), 1, 8));
  v_menu_token := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO organizations (id, name, logo_url, currency, timezone, country, settings)
  VALUES (
    v_org_id,
    p_org_name,
    NULLIF(trim(p_logo_url), ''),
    COALESCE(NULLIF(trim(p_currency), ''), 'USD'),
    COALESCE(NULLIF(trim(p_timezone), ''), 'America/New_York'),
    COALESCE(p_country, ''),
    jsonb_build_object(
      'tax_rate', COALESCE(p_tax_rate, 0),
      'tax_inclusive', COALESCE(p_tax_inclusive, true),
      'tax_enabled', COALESCE(p_tax_enabled, false)
    )
  );

  INSERT INTO stores (id, org_id, name, code, address, phone, timezone, is_active, settings)
  VALUES (
    v_store_id,
    v_org_id,
    p_store_name,
    COALESCE(NULLIF(trim(p_store_code), ''), slugify_store_name(p_store_name, 'main')),
    COALESCE(p_store_address, ''),
    COALESCE(p_store_phone, ''),
    NULLIF(trim(p_store_timezone), ''),
    true,
    jsonb_build_object(
      'online_menu_slug', v_menu_slug,
      'online_menu_token', v_menu_token
    )
  );

  PERFORM seed_org_defaults(v_org_id, v_store_id);

  SELECT id INTO cc_util FROM cost_centers WHERE org_id = v_org_id AND code = 'UTIL';
  SELECT id INTO cc_clean FROM cost_centers WHERE org_id = v_org_id AND code = 'CLEAN';
  SELECT id INTO cc_pack FROM cost_centers WHERE org_id = v_org_id AND code = 'PACK';

  UPDATE app_settings
  SET value = jsonb_build_object('rate', COALESCE(p_tax_rate, 0))
  WHERE org_id = v_org_id AND key = 'tax_rate';

  UPDATE app_settings
  SET value = jsonb_build_object('text', COALESCE(p_receipt_header, ''))
  WHERE org_id = v_org_id AND key = 'receipt_header';

  UPDATE app_settings
  SET value = jsonb_build_object('text', COALESCE(p_receipt_footer, ''))
  WHERE org_id = v_org_id AND key = 'receipt_footer';

  IF p_feature_flags IS NOT NULL AND p_feature_flags <> '{}'::jsonb THEN
    SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags';
    UPDATE app_settings
    SET value = COALESCE(v_flags, '{}'::jsonb) || p_feature_flags
    WHERE org_id = v_org_id AND key = 'feature_flags';
  END IF;

  IF NOT COALESCE(p_tax_enabled, false) THEN
    SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags';
    UPDATE app_settings
    SET value = COALESCE(v_flags, '{}'::jsonb) || jsonb_build_object('tax', false)
    WHERE org_id = v_org_id AND key = 'feature_flags';
  END IF;

  RETURN jsonb_build_object('org_id', v_org_id, 'store_id', v_store_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION initialize_organization(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION initialize_organization(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION seed_org_defaults(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_org_defaults(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket for organization assets (logos)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-assets',
  'org-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY org_assets_select ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[1] = auth_org_id()::text
  );

CREATE POLICY org_assets_insert ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND is_privileged_role()
    AND (storage.foldername(name))[1] = auth_org_id()::text
  );

CREATE POLICY org_assets_update ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND is_privileged_role()
    AND (storage.foldername(name))[1] = auth_org_id()::text
  );

CREATE POLICY org_assets_delete ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND is_privileged_role()
    AND (storage.foldername(name))[1] = auth_org_id()::text
  );

-- Public read for org logos (used in receipts / online menu)
CREATE POLICY org_assets_public_select ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'org-assets');
