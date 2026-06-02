-- Restrict app_settings mutations to owner/manager; keep org-wide read for authenticated members.

DROP POLICY IF EXISTS app_settings_org ON app_settings;

CREATE POLICY app_settings_select ON app_settings FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY app_settings_mutate ON app_settings FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

CREATE OR REPLACE FUNCTION is_feature_enabled(p_flag TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_flags JSONB;
  v_org_id UUID;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RETURN false; END IF;
  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  IF v_flags IS NULL THEN RETURN true; END IF;
  IF NOT (v_flags ? p_flag) THEN RETURN true; END IF;
  RETURN COALESCE((v_flags->>p_flag)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_feature_enabled TO authenticated;
