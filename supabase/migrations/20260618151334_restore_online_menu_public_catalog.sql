-- Restore branch-level public menu settings after the CafeFlow legacy cleanup.
-- This does not recreate online order intake tables; it only prepares public catalog URLs.
UPDATE stores
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object(
    'online_menu_enabled',
      COALESCE((settings->>'online_menu_enabled')::boolean, true),
    'online_menu_ordering_enabled',
      COALESCE((settings->>'online_menu_ordering_enabled')::boolean, true),
    'online_menu_slug',
      COALESCE(
        NULLIF(settings->>'online_menu_slug', ''),
        slugify_store_name(name, 'branch-' || substr(replace(id::text, '-', ''), 1, 8))
      ),
    'online_menu_token',
      COALESCE(NULLIF(settings->>'online_menu_token', ''), replace(gen_random_uuid()::text, '-', ''))
  )
WHERE is_active;
