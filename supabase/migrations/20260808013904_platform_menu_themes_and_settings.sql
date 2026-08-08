-- Platform-wide key/value settings (menu theme catalog prices, etc.).
-- Access only via service_role admin client — no direct PostgREST policies.

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_no_direct ON platform_settings;
CREATE POLICY platform_settings_no_direct ON platform_settings
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE platform_settings IS
  'Global SaaS control-plane settings. RLS deny-all; service_role only.';
