-- P0 tenant isolation: privileged roles must not pass has_store_access for
-- stores outside auth_org_id(). Previously is_privileged_role() alone granted
-- SELECT on all cashier_sessions / orders / expenses across tenants.

CREATE OR REPLACE FUNCTION public.has_store_access(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.org_id = public.auth_org_id()
      AND (
        public.is_privileged_role()
        OR EXISTS (
          SELECT 1
          FROM public.user_store_access usa
          JOIN public.users u ON u.id = usa.user_id
          WHERE u.auth_user_id = auth.uid()
            AND usa.store_id = p_store_id
        )
      )
  );
$$;
