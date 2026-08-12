-- Existing bootstrap functions predate kitchen_manage and enumerate cashier
-- permissions explicitly. Seed it for every future organization independently
-- of which onboarding entrypoint created that organization.
CREATE OR REPLACE FUNCTION public.seed_kitchen_permission_for_new_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO role_permissions (org_id, role, permission_key) VALUES
    (NEW.id, 'manager', 'kitchen_manage'),
    (NEW.id, 'cashier', 'kitchen_manage')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_seed_kitchen_permission ON organizations;
CREATE TRIGGER organizations_seed_kitchen_permission
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_kitchen_permission_for_new_org();

REVOKE ALL ON FUNCTION public.seed_kitchen_permission_for_new_org()
  FROM PUBLIC, anon, authenticated;
