-- Idempotent demo data for recipes/BOM testing (SweetFlow demo org).
-- Demo org is created in seed.sql (runs after migrations). On a fresh local
-- `supabase start` / `db reset`, skip here so migrate does not fail on FK;
-- the same payload is applied from seed.sql once the org exists.

DO $recipe_demo$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = '00000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE NOTICE '014_recipe_demo_seed: demo org missing — deferred to seed.sql';
    RETURN;
  END IF;

  INSERT INTO app_settings (org_id, key, value)
  VALUES (
    '00000000-0000-4000-8000-000000000001',
    'feature_flags',
    '{"recipes": true}'::jsonb
  )
  ON CONFLICT (org_id, key) DO UPDATE
  SET value = app_settings.value || '{"recipes": true}'::jsonb;

  INSERT INTO products (
    id, org_id, name, sku, barcode, category_id, base_price,
    is_active, is_popular, track_inventory, product_type, unit, last_unit_cost, cost_unit
  ) VALUES
    ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000001', 'Mango Bag', 'ING-001', '500001', '00000000-0000-4000-8000-000000000402', 0, true, false, true, 'ingredient', 'bag', 2.50, 'bag'),
    ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000001', 'Cup', 'ING-002', '500002', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'cup', 0.15, 'cup'),
    ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000001', 'Straw', 'ING-003', '500003', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'piece', 0.05, 'piece'),
    ('00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000001', 'Ice Cream Gallon', 'ING-004', '500004', '00000000-0000-4000-8000-000000000401', 0, true, false, true, 'ingredient', 'kg', 12.00, 'kg'),
    ('00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000001', 'Spoon', 'ING-005', '500005', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'spoon', 0.08, 'spoon')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO products (
    id, org_id, name, sku, barcode, category_id, base_price,
    is_active, is_popular, track_inventory, product_type, unit
  ) VALUES
    ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000001', 'Mango Juice', 'DRK-010', '200010', '00000000-0000-4000-8000-000000000402', 6.50, true, true, false, 'finished', 'piece'),
    ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000001', 'Ice Cream Cup', 'ICE-010', '100010', '00000000-0000-4000-8000-000000000401', 5.00, true, true, false, 'finished', 'piece')
  ON CONFLICT (id) DO NOTHING;

  UPDATE stock_levels sl
  SET quantity = seed.quantity, reorder_point = 10
  FROM warehouses w
  JOIN stores s ON s.id = w.store_id AND w.is_default
  CROSS JOIN (
    VALUES
      ('00000000-0000-4000-8000-000000000511'::uuid, 80::numeric),
      ('00000000-0000-4000-8000-000000000512'::uuid, 200::numeric),
      ('00000000-0000-4000-8000-000000000513'::uuid, 500::numeric),
      ('00000000-0000-4000-8000-000000000514'::uuid, 10::numeric),
      ('00000000-0000-4000-8000-000000000515'::uuid, 300::numeric)
  ) AS seed(product_id, quantity)
  WHERE sl.warehouse_id = w.id
    AND sl.product_id = seed.product_id
    AND sl.variant_id IS NULL
    AND s.org_id = '00000000-0000-4000-8000-000000000001';

  INSERT INTO stock_levels (warehouse_id, store_id, product_id, variant_id, quantity, reorder_point)
  SELECT w.id, w.store_id, seed.product_id, NULL, seed.quantity, 10
  FROM warehouses w
  JOIN stores s ON s.id = w.store_id AND w.is_default
  CROSS JOIN (
    VALUES
      ('00000000-0000-4000-8000-000000000511'::uuid, 80::numeric),
      ('00000000-0000-4000-8000-000000000512'::uuid, 200::numeric),
      ('00000000-0000-4000-8000-000000000513'::uuid, 500::numeric),
      ('00000000-0000-4000-8000-000000000514'::uuid, 10::numeric),
      ('00000000-0000-4000-8000-000000000515'::uuid, 300::numeric)
  ) AS seed(product_id, quantity)
  WHERE s.org_id = '00000000-0000-4000-8000-000000000001'
    AND NOT EXISTS (
      SELECT 1 FROM stock_levels sl
      WHERE sl.warehouse_id = w.id
        AND sl.product_id = seed.product_id
        AND sl.variant_id IS NULL
    );

  ALTER TABLE product_recipes DISABLE TRIGGER recipes_require_feature;
  ALTER TABLE product_recipe_lines DISABLE TRIGGER recipe_lines_require_feature;

  INSERT INTO product_recipes (id, org_id, product_id) VALUES
    ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000521'),
    ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000522')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO product_recipe_lines (recipe_id, ingredient_product_id, quantity, unit, sort_order) VALUES
    ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000511', 1, 'bag', 0),
    ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
    ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000513', 1, 'piece', 2),
    ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000514', 0.15, 'kg', 0),
    ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
    ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000515', 1, 'spoon', 2)
  ON CONFLICT (recipe_id, ingredient_product_id) DO NOTHING;

  ALTER TABLE product_recipes ENABLE TRIGGER recipes_require_feature;
  ALTER TABLE product_recipe_lines ENABLE TRIGGER recipe_lines_require_feature;
END
$recipe_demo$;
