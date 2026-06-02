-- Align DB feature-flag checks with app defaults; seed missing feature_flags; allow org updates.

INSERT INTO app_settings (org_id, key, value)
SELECT id, 'feature_flags', jsonb_build_object(
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
  'waste', true
)
FROM organizations
ON CONFLICT (org_id, key) DO NOTHING;

-- Match app isFeatureEnabled: enabled unless explicitly false in JSON.
CREATE OR REPLACE FUNCTION is_feature_enabled(p_flag TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_flags JSONB;
  v_org_id UUID;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RETURN false; END IF;

  SELECT value INTO v_flags
  FROM app_settings
  WHERE org_id = v_org_id AND key = 'feature_flags'
  LIMIT 1;

  IF v_flags IS NULL THEN
    RETURN true;
  END IF;

  IF NOT (v_flags ? p_flag) THEN
    RETURN true;
  END IF;

  RETURN COALESCE((v_flags->>p_flag)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_feature_enabled TO authenticated;

DROP POLICY IF EXISTS org_update_privileged ON organizations;
CREATE POLICY org_update_privileged ON organizations FOR UPDATE
  USING (id = auth_org_id() AND is_privileged_role())
  WITH CHECK (id = auth_org_id() AND is_privileged_role());
