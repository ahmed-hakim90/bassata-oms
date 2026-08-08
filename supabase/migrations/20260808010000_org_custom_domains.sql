-- White-label: one custom hostname per organization (ADR-compatible tenant config).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_custom_domain_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_custom_domain_status_check
  CHECK (
    custom_domain_status IN ('none', 'pending_dns', 'verifying', 'active', 'error')
  );

-- Normalize empty string to NULL
UPDATE organizations
SET custom_domain = NULL
WHERE custom_domain IS NOT NULL AND btrim(custom_domain) = '';

CREATE UNIQUE INDEX IF NOT EXISTS organizations_custom_domain_lower_uidx
  ON organizations (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;

COMMENT ON COLUMN organizations.custom_domain IS
  'Hostname only (no scheme), e.g. pos.client.com — white-label app + menu';
COMMENT ON COLUMN organizations.custom_domain_status IS
  'none | pending_dns | verifying | active | error';
