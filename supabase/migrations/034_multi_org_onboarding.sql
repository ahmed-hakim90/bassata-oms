-- True multi-organization onboarding and tenancy hardening

-- ---------------------------------------------------------------------------
-- Multi-org safe initialize_organization RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS initialize_organization(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB
);

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
  p_feature_flags JSONB,
  p_business_activity JSONB DEFAULT '{}'::jsonb,
  p_session_settings JSONB DEFAULT '{}'::jsonb,
  p_expense_settings JSONB DEFAULT '{}'::jsonb,
  p_payment_methods JSONB DEFAULT '{}'::jsonb,
  p_prevent_negative_stock BOOLEAN DEFAULT true,
  p_default_tax_behavior TEXT DEFAULT 'inclusive',
  p_seed_defaults JSONB DEFAULT '{}'::jsonb,
  p_owner_email TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_store_id UUID;
  v_menu_slug TEXT;
  v_menu_token TEXT;
  v_flags JSONB;
  v_defaults JSONB;
  v_business_defaults JSONB;
  v_session_defaults JSONB;
  v_expense_defaults JSONB;
BEGIN
  IF p_owner_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM users
    WHERE role = 'owner'
      AND lower(email) = lower(trim(p_owner_email))
  ) THEN
    RAISE EXCEPTION 'OWNER_EMAIL_ALREADY_USED' USING ERRCODE = 'P0001';
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
      'tax_inclusive',
        CASE WHEN p_default_tax_behavior = 'exclusive' THEN false ELSE COALESCE(p_tax_inclusive, true) END,
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

  v_defaults := COALESCE(p_seed_defaults, '{}'::jsonb);
  IF COALESCE((v_defaults->>'cost_centers')::boolean, true) THEN
    INSERT INTO cost_centers (org_id, name, code, type) VALUES
      (v_org_id, 'Utilities', 'UTIL', 'utilities'),
      (v_org_id, 'Cleaning', 'CLEAN', 'cleaning'),
      (v_org_id, 'Packaging', 'PACK', 'packaging'),
      (v_org_id, 'Maintenance', 'MAINT', 'maintenance'),
      (v_org_id, 'Salaries', 'SAL', 'salaries'),
      (v_org_id, 'Store Supplies', 'SUP', 'operations'),
      (v_org_id, 'Delivery', 'DEL', 'operations'),
      (v_org_id, 'Miscellaneous', 'MISC', 'other')
    ON CONFLICT (org_id, code) DO NOTHING;
  END IF;

  IF COALESCE((v_defaults->>'expense_categories')::boolean, true) THEN
    INSERT INTO expense_categories (org_id, cost_center_id, name, requires_inventory_item)
    SELECT
      v_org_id,
      cc.id,
      x.name,
      x.requires_inventory_item
    FROM (
      VALUES
        ('UTIL', 'Electricity', false),
        ('UTIL', 'Water', false),
        ('UTIL', 'Internet', false),
        ('CLEAN', 'Cleaning tools', false),
        ('CLEAN', 'Detergents', false),
        ('CLEAN', 'Trash bags', false),
        ('CLEAN', 'Cleaning Service', false),
        ('PACK', 'Cups', true),
        ('PACK', 'Spoons', true),
        ('PACK', 'Napkins', true),
        ('MAINT', 'Repairs', false),
        ('SAL', 'Payroll', false),
        ('MISC', 'Other', false),
        ('MISC', 'Petty cash', false),
        ('MISC', 'Supplies', false)
    ) AS x(cost_code, name, requires_inventory_item)
    JOIN cost_centers cc ON cc.org_id = v_org_id AND cc.code = x.cost_code
    ON CONFLICT (org_id, cost_center_id, name) DO NOTHING;
  END IF;

  IF COALESCE((v_defaults->>'product_categories')::boolean, true) THEN
    INSERT INTO categories (org_id, name) VALUES
      (v_org_id, 'Main'),
      (v_org_id, 'Beverages'),
      (v_org_id, 'Snacks')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT v_org_id, 'owner', key FROM permissions
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key)
  SELECT v_org_id, 'manager', key FROM permissions
  WHERE key NOT IN ('monthly_closing_reopen', 'user_manage')
  ON CONFLICT DO NOTHING;

  INSERT INTO role_permissions (org_id, role, permission_key) VALUES
    (v_org_id, 'manager', 'expense_create'),
    (v_org_id, 'manager', 'expense_edit'),
    (v_org_id, 'manager', 'expense_delete'),
    (v_org_id, 'manager', 'expense_view_all'),
    (v_org_id, 'manager', 'expense_approve'),
    (v_org_id, 'manager', 'expense_category_manage'),
    (v_org_id, 'manager', 'session_expense_create'),
    (v_org_id, 'manager', 'purchase_from_session_create'),
    (v_org_id, 'cashier', 'pos_access'),
    (v_org_id, 'cashier', 'checkout_create'),
    (v_org_id, 'cashier', 'order_view'),
    (v_org_id, 'cashier', 'session_open'),
    (v_org_id, 'cashier', 'session_close'),
    (v_org_id, 'cashier', 'session_view'),
    (v_org_id, 'cashier', 'session_expense_create'),
    (v_org_id, 'cashier', 'purchase_from_session_create'),
    (v_org_id, 'inventory', 'product_manage'),
    (v_org_id, 'inventory', 'recipe_manage'),
    (v_org_id, 'inventory', 'inventory_view'),
    (v_org_id, 'inventory', 'purchase_manage'),
    (v_org_id, 'inventory', 'transfer_manage'),
    (v_org_id, 'inventory', 'waste_manage'),
    (v_org_id, 'inventory', 'stock_count_manage'),
    (v_org_id, 'viewer', 'order_view'),
    (v_org_id, 'viewer', 'reports_view'),
    (v_org_id, 'viewer', 'expense_view_all')
  ON CONFLICT DO NOTHING;

  INSERT INTO warehouses (org_id, store_id, name, is_default, is_active)
  VALUES (v_org_id, v_store_id, 'Main warehouse', true, true)
  ON CONFLICT DO NOTHING;

  v_flags := jsonb_build_object(
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
    'payment_wallet', true,
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
    'online_orders', true,
    'supermarket_mode', false,
    'weight_sales', false,
    'price_by_amount', false,
    'wholesale_sales', false,
    'product_price_tiers', false,
    'fixed_weight_variants', false
  );

  v_flags := v_flags
    || COALESCE(p_feature_flags, '{}'::jsonb)
    || jsonb_build_object(
      'payment_cash', COALESCE((p_payment_methods->>'payment_cash')::boolean, (v_flags->>'payment_cash')::boolean),
      'payment_card', COALESCE((p_payment_methods->>'payment_card')::boolean, (v_flags->>'payment_card')::boolean),
      'payment_wallet', COALESCE((p_payment_methods->>'payment_wallet')::boolean, (v_flags->>'payment_wallet')::boolean),
      'payment_other', COALESCE((p_payment_methods->>'payment_other')::boolean, (v_flags->>'payment_other')::boolean),
      'credit_sales', COALESCE((p_payment_methods->>'payment_credit')::boolean, (v_flags->>'credit_sales')::boolean),
      'prevent_negative_stock', COALESCE(p_prevent_negative_stock, true)
    );

  v_business_defaults := jsonb_build_object(
    'activity_type', 'retail',
    'enabled_sales_modes', jsonb_build_array('retail'),
    'default_sales_mode', 'retail',
    'enable_weight_sales', false,
    'enable_piece_sales', true,
    'enable_wholesale_sales', false,
    'enable_variants', true,
    'enable_price_by_amount', false,
    'allow_cashier_wholesale', false,
    'require_manager_for_wholesale', true,
    'auto_apply_wholesale_by_quantity', false
  ) || COALESCE(p_business_activity, '{}'::jsonb);

  v_session_defaults := jsonb_build_object(
    'max_open_hours', 24,
    'warn_after_hours', 20,
    'block_sales_when_expired', true,
    'require_manager_override_for_expired_sale', true,
    'allow_manager_force_close', true
  ) || COALESCE(p_session_settings, '{}'::jsonb);

  v_expense_defaults := jsonb_build_object(
    'approval_required', false,
    'cashier_can_add_session_expense', true,
    'cashier_max_expense_amount', null,
    'allow_inventory_purchase_from_session', true,
    'default_cost_center_packaging', null,
    'default_cost_center_cleaning', null,
    'default_cost_center_utilities', null,
    'prevent_expenses_in_closed_periods', true
  ) || COALESCE(p_expense_settings, '{}'::jsonb);

  INSERT INTO app_settings (org_id, key, value) VALUES
    (v_org_id, 'feature_flags', v_flags),
    (v_org_id, 'tax_rate', jsonb_build_object('rate', COALESCE(p_tax_rate, 0))),
    (v_org_id, 'session_settings', v_session_defaults),
    (v_org_id, 'expense_settings', v_expense_defaults),
    (v_org_id, 'business_activity', v_business_defaults),
    (v_org_id, 'inventory_units', jsonb_build_array('piece', 'kg', 'gram', 'liter', 'ml')),
    (v_org_id, 'receipt_footer', jsonb_build_object('text', COALESCE(p_receipt_footer, ''))),
    (v_org_id, 'receipt_header', jsonb_build_object('text', COALESCE(p_receipt_header, '')))
  ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value;

  IF COALESCE((v_defaults->>'inventory_units')::boolean, true) = false THEN
    DELETE FROM app_settings WHERE org_id = v_org_id AND key = 'inventory_units';
  END IF;

  IF COALESCE((v_defaults->>'first_pos_device')::boolean, false) THEN
    INSERT INTO devices (store_id, name, device_key_hash, is_active)
    VALUES (
      v_store_id,
      COALESCE(NULLIF(trim(v_defaults->>'first_pos_device_name'), ''), 'POS-1'),
      extensions.crypt(
        'sf-device-' || v_store_id::text || '-' || md5(random()::text || clock_timestamp()::text),
        extensions.gen_salt('bf')
      ),
      true
    );
  END IF;

  RETURN jsonb_build_object('org_id', v_org_id, 'store_id', v_store_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE ALL ON FUNCTION initialize_organization(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, BOOLEAN, TEXT, JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION initialize_organization(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, BOOLEAN, TEXT, JSONB, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS hardening for cross-org mutation paths
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS usa_mutate ON user_store_access;
CREATE POLICY usa_mutate ON user_store_access FOR ALL
  USING (
    is_privileged_role()
    AND user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
    AND store_id IN (SELECT id FROM stores WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    is_privileged_role()
    AND user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
    AND store_id IN (SELECT id FROM stores WHERE org_id = auth_org_id())
  );

DROP POLICY IF EXISTS uda_mutate ON user_device_access;
CREATE POLICY uda_mutate ON user_device_access FOR ALL
  USING (
    is_privileged_role()
    AND user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
    AND device_id IN (
      SELECT d.id
      FROM devices d
      JOIN stores s ON s.id = d.store_id
      WHERE s.org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_privileged_role()
    AND user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
    AND device_id IN (
      SELECT d.id
      FROM devices d
      JOIN stores s ON s.id = d.store_id
      WHERE s.org_id = auth_org_id()
    )
  );

DROP POLICY IF EXISTS device_pairing_codes_privileged ON device_pairing_codes;
CREATE POLICY device_pairing_codes_privileged ON device_pairing_codes FOR ALL
  USING (
    is_privileged_role()
    AND device_id IN (
      SELECT d.id
      FROM devices d
      JOIN stores s ON s.id = d.store_id
      WHERE s.org_id = auth_org_id()
    )
    AND created_by IN (SELECT id FROM users WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    is_privileged_role()
    AND device_id IN (
      SELECT d.id
      FROM devices d
      JOIN stores s ON s.id = d.store_id
      WHERE s.org_id = auth_org_id()
    )
    AND created_by IN (SELECT id FROM users WHERE org_id = auth_org_id())
  );
