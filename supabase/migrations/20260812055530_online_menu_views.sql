-- First-party online menu open analytics (per store + source).
-- Write path: service_role SECURITY DEFINER only (mirror online_public_rate_events).
-- Read path: tenant SELECT via auth_org_id() (mirror audit_logs).

CREATE TABLE IF NOT EXISTS public.online_menu_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_menu_views_source_check
    CHECK (
      source IN (
        'qr',
        'whatsapp',
        'instagram',
        'facebook',
        'share',
        'link',
        'direct',
        'host',
        'other'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_online_menu_views_store_created
  ON public.online_menu_views (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_online_menu_views_org_created
  ON public.online_menu_views (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_online_menu_views_store_source_created
  ON public.online_menu_views (store_id, source, created_at DESC);

COMMENT ON TABLE public.online_menu_views IS
  'Public online-menu page opens attributed by ?src= (qr/whatsapp/…). No raw IPs.';

ALTER TABLE public.online_menu_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS online_menu_views_select_org ON public.online_menu_views;
CREATE POLICY online_menu_views_select_org
  ON public.online_menu_views
  FOR SELECT
  USING (org_id = public.auth_org_id());

-- No INSERT/UPDATE/DELETE policies for authenticated/anon — writes only via DEFINER RPC.

-- Insert only via this RPC (service_role). Derives org/store from slug server-side.
CREATE OR REPLACE FUNCTION public.record_online_menu_view(
  p_slug TEXT,
  p_source TEXT DEFAULT 'direct',
  p_org_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT := left(lower(trim(coalesce(p_slug, ''))), 120);
  v_source TEXT := lower(trim(coalesce(p_source, 'direct')));
  v_store public.stores%ROWTYPE;
BEGIN
  IF v_slug = '' AND p_org_id IS NULL THEN
    RETURN;
  END IF;

  IF v_source NOT IN (
    'qr', 'whatsapp', 'instagram', 'facebook', 'share', 'link', 'direct', 'host', 'other'
  ) THEN
    v_source := 'other';
  END IF;

  IF p_org_id IS NOT NULL THEN
    -- Custom-domain / host-bound menu: first active online-enabled store for org.
    SELECT s.* INTO v_store
    FROM public.stores s
    WHERE s.org_id = p_org_id
      AND s.is_active = true
      AND coalesce((s.settings->>'online_menu_enabled')::boolean, false) = true
    ORDER BY
      CASE WHEN nullif(trim(s.settings->>'online_menu_slug'), '') IS NOT NULL THEN 0 ELSE 1 END,
      s.name ASC
    LIMIT 1;
  ELSE
    SELECT s.* INTO v_store
    FROM public.stores s
    WHERE s.is_active = true
      AND lower(trim(coalesce(s.settings->>'online_menu_slug', ''))) = v_slug
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF coalesce((v_store.settings->>'online_menu_enabled')::boolean, false) IS NOT TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.online_menu_views (org_id, store_id, slug, source)
  VALUES (
    v_store.org_id,
    v_store.id,
    coalesce(nullif(v_slug, ''), left(lower(trim(coalesce(v_store.settings->>'online_menu_slug', ''))), 120), 'host'),
    v_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_online_menu_view(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_online_menu_view(TEXT, TEXT, UUID) TO service_role;

-- Compact stats for settings UI (last 7 / 30 days by source).
CREATE OR REPLACE FUNCTION public.get_online_menu_view_stats(
  p_store_id UUID,
  p_days INT DEFAULT 7
) RETURNS TABLE (
  source TEXT,
  view_count BIGINT,
  days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT := GREATEST(1, LEAST(coalesce(p_days, 7), 90));
  v_org UUID := public.auth_org_id();
BEGIN
  IF v_org IS NULL OR p_store_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = p_store_id
      AND s.org_id = v_org
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v.source,
    COUNT(*)::BIGINT AS view_count,
    v_days AS days
  FROM public.online_menu_views v
  WHERE v.store_id = p_store_id
    AND v.org_id = v_org
    AND v.created_at > now() - make_interval(days => v_days)
  GROUP BY v.source
  ORDER BY view_count DESC, v.source ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_online_menu_view_stats(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_menu_view_stats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_online_menu_view_stats(UUID, INT) TO service_role;
