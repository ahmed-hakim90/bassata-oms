-- SweetFlow seed data (run after migrations; link auth via npm run db:seed-auth)
-- Accounting (011+): cost centers, expense categories, permissions, expense_settings
-- are seeded automatically by migration 011_accounting_centers_expenses.sql per org.
-- Full RBAC permissions: migration 015_full_rbac_permissions.sql
-- Session settings + permissions: migration 018_session_management.sql
-- Device FK on delete: migration 019_device_delete_set_null.sql
-- POS device access: migration 021_pos_device_access.sql

INSERT INTO organizations (id, name, currency, timezone, settings)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'SweetFlow Demo',
  'USD',
  'America/New_York',
  '{"tax_rate": 0, "tax_inclusive": true}'::jsonb
);

INSERT INTO stores (id, org_id, name, address, is_active, settings) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Downtown', '123 Main St', true, '{"online_menu_slug": "downtown", "online_menu_token": "00000000000040008000000000000101"}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Mall Location', '456 Mall Blvd', true, '{"online_menu_slug": "mall-location", "online_menu_token": "00000000000040008000000000000102"}'::jsonb);

INSERT INTO users (id, org_id, auth_user_id, name, email, role, is_active) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', NULL, 'Alex Owner', 'owner@SweetFlow.local', 'owner', true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', NULL, 'Maya Manager', 'manager@SweetFlow.local', 'manager', true),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', NULL, 'Sam Cashier', 'cashier1@SweetFlow.local', 'cashier', true),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', NULL, 'Jordan Cashier', 'cashier2@SweetFlow.local', 'cashier', true),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', NULL, 'Riley Inventory', 'inventory@SweetFlow.local', 'inventory', true),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', NULL, 'Pat Viewer', 'viewer@SweetFlow.local', 'viewer', true);

INSERT INTO user_store_access (user_id, store_id) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000102');

INSERT INTO pin_codes (user_id, pin_hash, is_active) VALUES
  ('00000000-0000-4000-8000-000000000203', crypt('1234', gen_salt('bf')), true),
  ('00000000-0000-4000-8000-000000000204', crypt('1234', gen_salt('bf')), true);

INSERT INTO devices (id, store_id, name, device_key_hash, is_active) VALUES
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    'Register 1',
    crypt('seed-device-key-downtown', gen_salt('bf')),
    true
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000102',
    'Register 1',
    crypt('seed-device-key-mall', gen_salt('bf')),
    true
  );

INSERT INTO categories (id, org_id, name, sort_order, color, icon) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', 'Ice Cream', 1, '#60A5FA', 'ice-cream'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', 'Drinks', 2, '#34D399', 'cup-soda'),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', 'Desserts', 3, '#F472B6', 'cake'),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', 'Toppings', 4, '#FBBF24', 'sparkles');

INSERT INTO products (id, org_id, name, sku, barcode, category_id, base_price, is_active, is_popular, track_inventory) VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'Vanilla Scoop', 'ICE-001', '100001', '00000000-0000-4000-8000-000000000401', 4.50, true, true, true),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', 'Chocolate Scoop', 'ICE-002', '100002', '00000000-0000-4000-8000-000000000401', 4.50, true, true, true),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', 'Strawberry Scoop', 'ICE-003', '100003', '00000000-0000-4000-8000-000000000401', 4.75, true, false, true),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000001', 'Iced Latte', 'DRK-001', '200001', '00000000-0000-4000-8000-000000000402', 5.50, true, true, true),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000001', 'Berry Smoothie', 'DRK-002', '200002', '00000000-0000-4000-8000-000000000402', 6.25, true, false, true),
  ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000001', 'Waffle Cone', 'DES-001', '300001', '00000000-0000-4000-8000-000000000403', 3.00, true, true, true),
  ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000001', 'Brownie Sundae', 'DES-002', '300002', '00000000-0000-4000-8000-000000000403', 8.50, true, true, true),
  ('00000000-0000-4000-8000-000000000508', '00000000-0000-4000-8000-000000000001', 'Extra Sprinkles', 'TOP-001', '400001', '00000000-0000-4000-8000-000000000404', 0.75, true, false, true);

INSERT INTO stock_levels (store_id, product_id, variant_id, quantity, reorder_point)
SELECT s.id, p.id, NULL,
  CASE WHEN s.id = '00000000-0000-4000-8000-000000000101' THEN 45 ELSE 32 END,
  10
FROM stores s
CROSS JOIN products p
WHERE s.org_id = '00000000-0000-4000-8000-000000000001';

UPDATE stock_levels SET quantity = 6
WHERE store_id = '00000000-0000-4000-8000-000000000102'
  AND product_id = '00000000-0000-4000-8000-000000000503';

INSERT INTO suppliers (id, org_id, name, contact_info) VALUES
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', 'Fresh Dairy Co.', 'orders@freshdairy.com'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', 'Sweet Supplies', 'sales@sweetsupplies.com');

INSERT INTO customers (id, org_id, name, phone, email, total_spent, visit_count, notes) VALUES
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', 'Emma Wilson', '+15551234567', 'emma@email.com', 124.50, 18, 'Loves vanilla'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', 'Liam Chen', '+15559876543', NULL, 67.25, 9, '');

INSERT INTO loyalty_rules (id, org_id, points_per_currency, redemption_rate, is_active)
VALUES ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', 1, 0.01, true);

INSERT INTO loyalty_ledger (customer_id, points_delta, balance_after, reason)
VALUES ('00000000-0000-4000-8000-000000000701', 50, 50, 'Welcome bonus');

INSERT INTO app_settings (org_id, key, value)
VALUES ('00000000-0000-4000-8000-000000000001', 'receipt_footer', '{"text": "Thank you for visiting SweetFlow!"}'::jsonb);

INSERT INTO app_settings (org_id, key, value)
VALUES ('00000000-0000-4000-8000-000000000001', 'tax_rate', '{"rate": 0}'::jsonb);

INSERT INTO app_settings (org_id, key, value)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'feature_flags',
  '{"recipes": true}'::jsonb
)
ON CONFLICT (org_id, key) DO UPDATE
SET value = app_settings.value || '{"recipes": true}'::jsonb;

INSERT INTO app_settings (org_id, key, value)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'session_settings',
  jsonb_build_object(
    'max_open_hours', 24,
    'warn_after_hours', 20,
    'block_sales_when_expired', true,
    'require_manager_override_for_expired_sale', true,
    'allow_manager_force_close', true
  )
)
ON CONFLICT (org_id, key) DO NOTHING;

-- Session RBAC (018 may run before demo org exists on fresh reset)
INSERT INTO role_permissions (org_id, role, permission_key) VALUES
  ('00000000-0000-4000-8000-000000000001', 'owner', 'session_view_all'),
  ('00000000-0000-4000-8000-000000000001', 'owner', 'session_force_close'),
  ('00000000-0000-4000-8000-000000000001', 'owner', 'session_settings_manage'),
  ('00000000-0000-4000-8000-000000000001', 'manager', 'session_view_all'),
  ('00000000-0000-4000-8000-000000000001', 'manager', 'session_force_close'),
  ('00000000-0000-4000-8000-000000000001', 'manager', 'session_settings_manage')
ON CONFLICT DO NOTHING;

-- Demo open sessions for lifecycle QA (normal / warning / expired)
INSERT INTO cashier_sessions (
  id, store_id, device_id, cashier_id, opened_at, opening_cash, status
) VALUES
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000203',
    now() - interval '3 hours',
    100,
    'open'
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000204',
    now() - interval '21 hours',
    75,
    'open'
  ),
  (
    '00000000-0000-4000-8000-000000000803',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000202',
    now() - interval '25 hours',
    50,
    'open'
  )
ON CONFLICT (id) DO NOTHING;

-- Recipe demo: ingredients
INSERT INTO products (
  id, org_id, name, sku, barcode, category_id, base_price,
  is_active, is_popular, track_inventory, product_type, unit, last_unit_cost, cost_unit
) VALUES
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000001', 'Mango Bag', 'ING-001', '500001', '00000000-0000-4000-8000-000000000402', 0, true, false, true, 'ingredient', 'bag', 2.50, 'bag'),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000001', 'Cup', 'ING-002', '500002', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'cup', 0.15, 'cup'),
  ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000001', 'Straw', 'ING-003', '500003', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'piece', 0.05, 'piece'),
  ('00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000001', 'Ice Cream Gallon', 'ING-004', '500004', '00000000-0000-4000-8000-000000000401', 0, true, false, true, 'ingredient', 'kg', 12.00, 'kg'),
  ('00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000001', 'Spoon', 'ING-005', '500005', '00000000-0000-4000-8000-000000000404', 0, true, false, true, 'ingredient', 'spoon', 0.08, 'spoon');

-- Finished products with recipes
INSERT INTO products (
  id, org_id, name, sku, barcode, category_id, base_price,
  is_active, is_popular, track_inventory, product_type, unit
) VALUES
  ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000001', 'Mango Juice', 'DRK-010', '200010', '00000000-0000-4000-8000-000000000402', 6.50, true, true, false, 'finished', 'piece'),
  ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000001', 'Ice Cream Cup', 'ICE-010', '100010', '00000000-0000-4000-8000-000000000401', 5.00, true, true, false, 'finished', 'piece');

INSERT INTO stock_levels (warehouse_id, store_id, product_id, variant_id, quantity, reorder_point)
SELECT w.id, w.store_id, p.id, NULL,
  CASE p.id
    WHEN '00000000-0000-4000-8000-000000000511' THEN 80
    WHEN '00000000-0000-4000-8000-000000000512' THEN 200
    WHEN '00000000-0000-4000-8000-000000000513' THEN 500
    WHEN '00000000-0000-4000-8000-000000000514' THEN 10
    WHEN '00000000-0000-4000-8000-000000000515' THEN 300
    ELSE 0
  END,
  10
FROM warehouses w
JOIN stores s ON s.id = w.store_id AND w.is_default
CROSS JOIN products p
WHERE s.org_id = '00000000-0000-4000-8000-000000000001'
  AND p.id IN (
    '00000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000512',
    '00000000-0000-4000-8000-000000000513',
    '00000000-0000-4000-8000-000000000514',
    '00000000-0000-4000-8000-000000000515'
  );

ALTER TABLE product_recipes DISABLE TRIGGER recipes_require_feature;
ALTER TABLE product_recipe_lines DISABLE TRIGGER recipe_lines_require_feature;

INSERT INTO product_recipes (id, org_id, product_id) VALUES
  ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000521'),
  ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000522');

INSERT INTO product_recipe_lines (recipe_id, ingredient_product_id, quantity, unit, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000511', 1, 'bag', 0),
  ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
  ('00000000-0000-4000-8000-000000000531', '00000000-0000-4000-8000-000000000513', 1, 'piece', 2),
  ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000514', 0.15, 'kg', 0),
  ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
  ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000515', 1, 'spoon', 2);

-- Supplier AP demo: received purchase + payment (Downtown / Fresh Dairy)
INSERT INTO purchase_invoices (
  id, store_id, warehouse_id, supplier_id, invoice_number, status,
  subtotal, tax, total, received_at, created_by
)
SELECT
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000101',
  w.id,
  '00000000-0000-4000-8000-000000000601',
  'PO-DEMO-001',
  'received',
  500.00, 0, 500.00,
  now() - interval '7 days',
  '00000000-0000-4000-8000-000000000201'
FROM warehouses w
WHERE w.store_id = '00000000-0000-4000-8000-000000000101' AND w.is_default
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_payments (
  id, org_id, store_id, supplier_id, amount, payment_method, reference, paid_at, created_by
) VALUES (
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000601',
  200.00,
  'cash',
  'DEMO-PAY-1',
  now() - interval '3 days',
  '00000000-0000-4000-8000-000000000201'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE product_recipes ENABLE TRIGGER recipes_require_feature;
ALTER TABLE product_recipe_lines ENABLE TRIGGER recipe_lines_require_feature;

-- Vanilla Scoop variants demo (017)
UPDATE products SET track_inventory = false
WHERE id = '00000000-0000-4000-8000-000000000501';

DELETE FROM stock_levels
WHERE product_id = '00000000-0000-4000-8000-000000000501' AND variant_id IS NULL;

INSERT INTO product_variants (id, product_id, name, sku, barcode, price_delta, price, is_active) VALUES
  ('00000000-0000-4000-8000-000000000541', '00000000-0000-4000-8000-000000000501', 'Small', 'ICE-001-S', '100001-S', 0, 4.50, true),
  ('00000000-0000-4000-8000-000000000542', '00000000-0000-4000-8000-000000000501', 'Large', 'ICE-001-L', '100001-L', 0, 6.50, true);

ALTER TABLE product_recipes DISABLE TRIGGER recipes_require_feature;
ALTER TABLE product_recipe_lines DISABLE TRIGGER recipe_lines_require_feature;

INSERT INTO product_recipes (id, org_id, product_id, variant_id) VALUES
  ('00000000-0000-4000-8000-000000000551', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000541'),
  ('00000000-0000-4000-8000-000000000552', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000542')
ON CONFLICT DO NOTHING;

INSERT INTO product_recipe_lines (recipe_id, ingredient_product_id, quantity, unit, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000551', '00000000-0000-4000-8000-000000000514', 0.08, 'kg', 0),
  ('00000000-0000-4000-8000-000000000551', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
  ('00000000-0000-4000-8000-000000000551', '00000000-0000-4000-8000-000000000515', 1, 'spoon', 2),
  ('00000000-0000-4000-8000-000000000552', '00000000-0000-4000-8000-000000000514', 0.15, 'kg', 0),
  ('00000000-0000-4000-8000-000000000552', '00000000-0000-4000-8000-000000000512', 1, 'cup', 1),
  ('00000000-0000-4000-8000-000000000552', '00000000-0000-4000-8000-000000000515', 1, 'spoon', 2)
ON CONFLICT (recipe_id, ingredient_product_id) DO NOTHING;

ALTER TABLE product_recipes ENABLE TRIGGER recipes_require_feature;
ALTER TABLE product_recipe_lines ENABLE TRIGGER recipe_lines_require_feature;
