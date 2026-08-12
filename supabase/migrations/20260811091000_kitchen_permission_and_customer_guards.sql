-- Separate kitchen mutations from read-only order access.
INSERT INTO permissions (key, label, description, group_name)
VALUES (
  'kitchen_manage',
  'إدارة شاشة المطبخ',
  'نقل طلبات المطبخ بين حالات التحضير والتجهيز والتسليم',
  'orders'
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name;

INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, roles.role, 'kitchen_manage'
FROM organizations o
CROSS JOIN (VALUES ('manager'::user_role), ('cashier'::user_role)) AS roles(role)
ON CONFLICT DO NOTHING;

-- Service validation is backed by database constraints so alternate write paths
-- cannot persist blank names or negative credit limits. NOT VALID preserves any
-- legacy rows while still enforcing the rules for new/updated records.
ALTER TABLE customers
  ADD CONSTRAINT customers_name_trimmed_min_length
  CHECK (length(btrim(name)) >= 2) NOT VALID;

ALTER TABLE customers
  ADD CONSTRAINT customers_credit_limit_non_negative
  CHECK (credit_limit >= 0) NOT VALID;
