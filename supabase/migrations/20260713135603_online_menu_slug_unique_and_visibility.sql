-- S05 / ADR-004: globally unique online_menu_slug + product online visibility.
-- Modes: public slug vs unlisted token (settings.online_menu_unlisted + online_menu_token).

-- 1) Backfill slug/token/unlisted; resolve global slug collisions (keep lowest store id).
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  final_slug TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT
      id,
      name,
      lower(nullif(trim(coalesce(settings->>'online_menu_slug', '')), '')) AS current_slug
    FROM stores
    ORDER BY id
  LOOP
    base_slug := r.current_slug;
    IF base_slug IS NULL OR length(base_slug) < 2 THEN
      base_slug := lower(trim(both '-' from regexp_replace(trim(r.name), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g')));
    END IF;
    IF base_slug IS NULL OR length(base_slug) < 2 THEN
      base_slug := 'branch-' || right(replace(r.id::text, '-', ''), 8);
    END IF;

    final_slug := base_slug;
    n := 1;
    WHILE EXISTS (
      SELECT 1
      FROM stores x
      WHERE x.id < r.id
        AND lower(coalesce(x.settings->>'online_menu_slug', '')) = final_slug
    ) LOOP
      final_slug := base_slug || '-' || n::text;
      n := n + 1;
    END LOOP;

    UPDATE stores
    SET settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object(
        'online_menu_slug', final_slug,
        'online_menu_token',
          coalesce(
            nullif(settings->>'online_menu_token', ''),
            replace(gen_random_uuid()::text, '-', '')
          ),
        'online_menu_unlisted',
          coalesce((settings->>'online_menu_unlisted')::boolean, false),
        'online_menu_enabled',
          coalesce((settings->>'online_menu_enabled')::boolean, true),
        'online_menu_ordering_enabled',
          coalesce((settings->>'online_menu_ordering_enabled')::boolean, true)
      )
    WHERE id = r.id;
  END LOOP;
END $$;

-- 2) Global unique index on menu slug (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS stores_online_menu_slug_lower_uidx
  ON stores ((lower(settings->>'online_menu_slug')))
  WHERE coalesce(settings->>'online_menu_slug', '') <> '';

-- 3) Product visibility for public online menu (§8.2).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS show_on_online_menu boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.show_on_online_menu IS
  'Public online menu visibility. Seed: finished products true; raw materials false (ADR-004 / §8.2).';

UPDATE products
SET show_on_online_menu = (
  product_type = 'finished'
  AND inventory_product_type = 'finished_product'
);
