-- Backfill human-readable branch slugs for public menu URLs.
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  final_slug TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, org_id, name
    FROM stores
    WHERE NOT COALESCE(settings, '{}'::jsonb) ? 'online_menu_slug'
  LOOP
    base_slug := lower(regexp_replace(trim(r.name), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);

    IF length(base_slug) < 2 THEN
      base_slug := 'branch-' || right(replace(r.id::text, '-', ''), 8);
    END IF;

    final_slug := base_slug;
    n := 1;
    WHILE EXISTS (
      SELECT 1
      FROM stores x
      WHERE x.org_id = r.org_id
        AND x.id <> r.id
        AND COALESCE(x.settings->>'online_menu_slug', '') = final_slug
    ) LOOP
      final_slug := base_slug || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE stores
    SET settings = COALESCE(settings, '{}'::jsonb)
      || jsonb_build_object('online_menu_slug', final_slug)
    WHERE id = r.id;
  END LOOP;
END $$;
