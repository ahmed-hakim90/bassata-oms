-- Restore monthly closing + period lock (removed by cafeflow_legacy_cleanup).

CREATE TABLE IF NOT EXISTS monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status monthly_close_status NOT NULL DEFAULT 'draft',
  summary JSONB NOT NULL DEFAULT '{}',
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  CONSTRAINT monthly_closes_period_order CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_monthly_closes_org_period
  ON monthly_closes (org_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_monthly_closes_store_status
  ON monthly_closes (org_id, store_id, status);

ALTER TABLE monthly_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_closes_org ON monthly_closes;
CREATE POLICY monthly_closes_org ON monthly_closes FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE OR REPLACE FUNCTION is_period_closed(p_store_id UUID, p_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM monthly_closes mc
    WHERE mc.org_id = auth_org_id()
      AND mc.status = 'closed'
      AND p_at::date >= mc.period_start
      AND p_at::date <= mc.period_end
      AND (mc.store_id IS NULL OR mc.store_id = p_store_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION is_period_closed(UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION trg_monthly_closing_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('monthly_closing');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS monthly_closing_require_feature ON monthly_closes;
CREATE TRIGGER monthly_closing_require_feature
  BEFORE INSERT OR UPDATE ON monthly_closes
  FOR EACH ROW EXECUTE FUNCTION trg_monthly_closing_require_feature();

INSERT INTO permissions (key, label, description, group_name)
VALUES
  ('monthly_closing_manage', 'Monthly closing', 'Generate and close monthly periods', 'system'),
  ('monthly_closing_reopen', 'Reopen periods', 'Reopen closed accounting periods', 'system')
ON CONFLICT (key) DO NOTHING;

-- Ensure managers can manage (not reopen) for every org.
INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, 'manager', 'monthly_closing_manage'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.org_id = o.id
    AND rp.role = 'manager'
    AND rp.permission_key = 'monthly_closing_manage'
);

INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, 'owner', p.key
FROM organizations o
CROSS JOIN (VALUES ('monthly_closing_manage'), ('monthly_closing_reopen')) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.org_id = o.id
    AND rp.role = 'owner'
    AND rp.permission_key = p.key
);

-- Re-enable feature flag key on existing orgs (owners can turn off in Settings).
UPDATE app_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{monthly_closing}', 'true'::jsonb, true)
WHERE key = 'feature_flags'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'monthly_closing');
