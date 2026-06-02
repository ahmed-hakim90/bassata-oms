-- Recipes / BOM, unit costing, and checkout ingredient deduction

CREATE TYPE product_type AS ENUM ('finished', 'ingredient');
CREATE TYPE measurement_unit AS ENUM (
  'piece', 'bag', 'cup', 'spoon', 'gram', 'kg', 'ml', 'liter'
);

ALTER TABLE products
  ADD COLUMN product_type product_type NOT NULL DEFAULT 'finished',
  ADD COLUMN unit measurement_unit NOT NULL DEFAULT 'piece',
  ADD COLUMN last_unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN cost_unit measurement_unit NOT NULL DEFAULT 'piece';

UPDATE products SET cost_unit = unit;

ALTER TABLE stock_levels
  ALTER COLUMN quantity TYPE NUMERIC(12,4) USING quantity::NUMERIC(12,4);

ALTER TABLE inventory_movements
  ALTER COLUMN quantity_delta TYPE NUMERIC(12,4) USING quantity_delta::NUMERIC(12,4);

ALTER TABLE purchase_invoice_lines
  ALTER COLUMN quantity TYPE NUMERIC(12,4) USING quantity::NUMERIC(12,4);

ALTER TABLE order_items
  ADD COLUMN unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN line_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id)
);

CREATE TABLE product_recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES product_recipes(id) ON DELETE CASCADE,
  ingredient_product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit measurement_unit NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (recipe_id, ingredient_product_id)
);

CREATE TABLE order_item_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  ingredient_product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,4) NOT NULL,
  unit measurement_unit NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  line_cost NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_recipe_lines_recipe ON product_recipe_lines(recipe_id);
CREATE INDEX idx_order_item_deductions_item ON order_item_deductions(order_item_id);

-- Unit conversion: kg<->gram, liter<->ml; count units must match
CREATE OR REPLACE FUNCTION convert_unit(
  p_qty NUMERIC,
  p_from measurement_unit,
  p_to measurement_unit
) RETURNS NUMERIC AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN p_qty;
  END IF;
  IF p_from = 'kg' AND p_to = 'gram' THEN RETURN p_qty * 1000; END IF;
  IF p_from = 'gram' AND p_to = 'kg' THEN RETURN p_qty / 1000; END IF;
  IF p_from = 'liter' AND p_to = 'ml' THEN RETURN p_qty * 1000; END IF;
  IF p_from = 'ml' AND p_to = 'liter' THEN RETURN p_qty / 1000; END IF;
  RAISE EXCEPTION 'Cannot convert % to %', p_from, p_to;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION can_view_costs() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_manage_recipes() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION compute_recipe_cost(p_recipe_id UUID) RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC := 0;
  rec RECORD;
  v_cost_qty NUMERIC;
BEGIN
  FOR rec IN
    SELECT rl.quantity, rl.unit, p.last_unit_cost, p.cost_unit
    FROM product_recipe_lines rl
    JOIN products p ON p.id = rl.ingredient_product_id
    WHERE rl.recipe_id = p_recipe_id
  LOOP
    v_cost_qty := convert_unit(rec.quantity, rec.unit, rec.cost_unit);
    v_total := v_total + (v_cost_qty * rec.last_unit_cost);
  END LOOP;
  RETURN round(v_total, 4);
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipe_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipes_org ON product_recipes FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id() AND can_manage_recipes());

CREATE POLICY recipe_lines_org ON product_recipe_lines FOR ALL
  USING (
    recipe_id IN (SELECT id FROM product_recipes WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    recipe_id IN (SELECT id FROM product_recipes WHERE org_id = auth_org_id())
    AND can_manage_recipes()
  );

CREATE POLICY order_deductions_select ON order_item_deductions FOR SELECT
  USING (
    order_item_id IN (
      SELECT oi.id FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE has_store_access(o.store_id)
    )
  );

CREATE POLICY order_deductions_no_direct_write ON order_item_deductions FOR INSERT
  WITH CHECK (false);

-- Feature flag: recipes (default false)
UPDATE app_settings
SET value = value || jsonb_build_object('recipes', false)
WHERE key = 'feature_flags';

INSERT INTO app_settings (org_id, key, value)
SELECT id, 'feature_flags', jsonb_build_object('recipes', false)
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings a WHERE a.org_id = organizations.id AND a.key = 'feature_flags'
);

CREATE OR REPLACE FUNCTION trg_recipes_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('recipes');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_require_feature
  BEFORE INSERT OR UPDATE OR DELETE ON product_recipes
  FOR EACH ROW EXECUTE FUNCTION trg_recipes_require_feature();

CREATE TRIGGER recipe_lines_require_feature
  BEFORE INSERT OR UPDATE OR DELETE ON product_recipe_lines
  FOR EACH ROW EXECUTE FUNCTION trg_recipes_require_feature();

-- Updated checkout with recipe ingredient deduction
CREATE OR REPLACE FUNCTION complete_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC;
  v_line JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_qty INT;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_line_cost NUMERIC;
  v_unit_cost NUMERIC;
  v_track BOOLEAN;
  v_stock_qty NUMERIC;
  v_product_name TEXT;
  v_product_type product_type;
  v_today TEXT;
  v_count INT;
  v_tax_rate NUMERIC := 0;
  v_setting JSONB;
  v_flags JSONB := '{}'::jsonb;
  v_recipes_enabled BOOLEAN;
  v_recipe_id UUID;
  v_order_item_id UUID;
  v_ingredient RECORD;
  v_deduct_qty NUMERIC;
  v_ingredient_cost NUMERIC;
  v_deduction_cost NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF is_period_closed(p_store_id, now()) THEN RAISE EXCEPTION 'Period is closed for this date'; END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_recipes_enabled := COALESCE((v_flags->>'recipes')::boolean, false);

  IF COALESCE((v_flags->>'inventory_deduction')::boolean, true) = false THEN
    RAISE EXCEPTION 'Inventory deduction is disabled';
  END IF;
  IF p_payment_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
    RAISE EXCEPTION 'Cash payments are disabled';
  END IF;
  IF p_payment_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
    RAISE EXCEPTION 'Card payments are disabled';
  END IF;
  IF p_payment_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
    RAISE EXCEPTION 'Other payments are disabled';
  END IF;
  IF COALESCE(p_discount, 0) > 0 AND COALESCE((v_flags->>'customer_discounts')::boolean, false) = false THEN
    RAISE EXCEPTION 'Customer discounts are disabled';
  END IF;

  IF p_session_id IS NULL THEN RAISE EXCEPTION 'Active cashier session required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM cashier_sessions
    WHERE id = p_session_id AND store_id = p_store_id AND status = 'open' AND cashier_id = p_cashier_id
  ) THEN
    RAISE EXCEPTION 'Invalid or closed cashier session';
  END IF;

  IF COALESCE((v_flags->>'tax')::boolean, true) THEN
    SELECT value INTO v_setting FROM app_settings WHERE org_id = v_org_id AND key = 'tax_rate' LIMIT 1;
    IF v_setting IS NOT NULL THEN
      v_tax_rate := COALESCE((v_setting->>'rate')::numeric, 0);
    END IF;
  END IF;

  v_today := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count FROM orders
  WHERE store_id = p_store_id AND created_at::date = now()::date;
  v_order_number := 'SF-' || v_today || '-' || lpad(v_count::text, 4, '0');

  -- Pass 1: validate and compute subtotal; check stock
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := (v_line->>'quantity')::int;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT p.base_price + COALESCE(pv.price_delta, 0), p.track_inventory, p.name, p.product_type
    INTO v_unit_price, v_track, v_product_name, v_product_type
    FROM products p
    LEFT JOIN product_variants pv ON pv.id = v_variant_id
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_product_type = 'ingredient' THEN
      RAISE EXCEPTION 'Ingredient products cannot be sold directly';
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_recipe_id := NULL;
    IF v_recipes_enabled THEN
      SELECT id INTO v_recipe_id FROM product_recipes WHERE product_id = v_product_id;
    END IF;

    IF v_recipes_enabled AND v_recipe_id IS NOT NULL THEN
      FOR v_ingredient IN
        SELECT rl.quantity AS recipe_qty, rl.unit AS recipe_unit,
               p.id AS ing_id, p.name AS ing_name, p.unit AS stock_unit
        FROM product_recipe_lines rl
        JOIN products p ON p.id = rl.ingredient_product_id
        WHERE rl.recipe_id = v_recipe_id
      LOOP
        v_deduct_qty := convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.stock_unit);
        IF COALESCE((v_flags->>'prevent_negative_stock')::boolean, true) THEN
          SELECT quantity INTO v_stock_qty FROM stock_levels
          WHERE store_id = p_store_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL
          FOR UPDATE;
          IF v_stock_qty IS NULL OR v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %', v_ingredient.ing_name;
          END IF;
        END IF;
      END LOOP;
    ELSIF v_track AND COALESCE((v_flags->>'prevent_negative_stock')::boolean, true) THEN
      SELECT quantity INTO v_stock_qty FROM stock_levels
      WHERE store_id = p_store_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id)
      FOR UPDATE;
      IF v_stock_qty IS NULL OR v_stock_qty < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_product_name;
      END IF;
    END IF;
  END LOOP;

  v_tax := round(v_subtotal * v_tax_rate, 2);
  v_total := greatest(0, v_subtotal - COALESCE(p_discount, 0) + v_tax);

  INSERT INTO orders (
    store_id, session_id, order_number, customer_id, status,
    subtotal, discount, tax, total, payment_status, created_by
  ) VALUES (
    p_store_id, p_session_id, v_order_number, p_customer_id, 'completed',
    v_subtotal, COALESCE(p_discount, 0), v_tax, v_total, 'paid', p_cashier_id
  ) RETURNING id INTO v_order_id;

  -- Pass 2: insert items, deduct stock, record COGS
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := (v_line->>'quantity')::int;

    SELECT p.base_price + COALESCE(pv.price_delta, 0), p.track_inventory, p.name
    INTO v_unit_price, v_track, v_product_name
    FROM products p
    LEFT JOIN product_variants pv ON pv.id = v_variant_id
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    v_line_total := v_unit_price * v_qty;
    v_line_cost := 0;
    v_unit_cost := 0;
    v_recipe_id := NULL;

    IF v_recipes_enabled THEN
      SELECT id INTO v_recipe_id FROM product_recipes WHERE product_id = v_product_id;
    END IF;

    IF v_recipes_enabled AND v_recipe_id IS NOT NULL THEN
      FOR v_ingredient IN
        SELECT rl.quantity AS recipe_qty, rl.unit AS recipe_unit,
               p.id AS ing_id, p.name AS ing_name, p.unit AS stock_unit,
               p.last_unit_cost, p.cost_unit
        FROM product_recipe_lines rl
        JOIN products p ON p.id = rl.ingredient_product_id
        WHERE rl.recipe_id = v_recipe_id
      LOOP
        v_deduct_qty := convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.stock_unit);
        v_ingredient_cost := convert_unit(v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit) * v_ingredient.last_unit_cost;
        v_deduction_cost := round(v_ingredient_cost * v_qty, 2);
        v_line_cost := v_line_cost + v_deduction_cost;
      END LOOP;
      v_unit_cost := CASE WHEN v_qty > 0 THEN round(v_line_cost / v_qty, 4) ELSE 0 END;
    END IF;

    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, unit_price, modifiers, line_total,
      unit_cost, line_cost
    ) VALUES (
      v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price, '[]'::jsonb, v_line_total,
      v_unit_cost, v_line_cost
    ) RETURNING id INTO v_order_item_id;

    IF v_recipes_enabled AND v_recipe_id IS NOT NULL THEN
      FOR v_ingredient IN
        SELECT rl.quantity AS recipe_qty, rl.unit AS recipe_unit,
               p.id AS ing_id, p.unit AS stock_unit,
               p.last_unit_cost, p.cost_unit
        FROM product_recipe_lines rl
        JOIN products p ON p.id = rl.ingredient_product_id
        WHERE rl.recipe_id = v_recipe_id
      LOOP
        v_deduct_qty := convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.stock_unit);
        v_ingredient_cost := convert_unit(v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit) * v_ingredient.last_unit_cost;
        v_deduction_cost := round(v_ingredient_cost * v_qty, 2);

        UPDATE stock_levels SET quantity = quantity - v_deduct_qty, updated_at = now()
        WHERE store_id = p_store_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, movement_type, quantity_delta,
          reference_type, reference_id, created_by
        ) VALUES (
          p_store_id, v_ingredient.ing_id, NULL, 'sale', -v_deduct_qty,
          'order', v_order_id, p_cashier_id
        );

        INSERT INTO order_item_deductions (
          order_item_id, ingredient_product_id, quantity, unit, unit_cost, line_cost
        ) VALUES (
          v_order_item_id, v_ingredient.ing_id,
          convert_unit(v_ingredient.recipe_qty * v_qty, v_ingredient.recipe_unit, v_ingredient.recipe_unit),
          v_ingredient.recipe_unit,
          round(convert_unit(v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit) * v_ingredient.last_unit_cost, 4),
          v_deduction_cost
        );
      END LOOP;
    ELSIF v_track THEN
      UPDATE stock_levels SET quantity = quantity - v_qty, updated_at = now()
      WHERE store_id = p_store_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id);

      INSERT INTO inventory_movements (
        store_id, product_id, variant_id, movement_type, quantity_delta,
        reference_type, reference_id, created_by
      ) VALUES (
        p_store_id, v_product_id, v_variant_id, 'sale', -v_qty,
        'order', v_order_id, p_cashier_id
      );
    END IF;
  END LOOP;

  INSERT INTO order_payments (order_id, method, amount)
  VALUES (v_order_id, p_payment_method, v_total);

  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_spent = total_spent + v_total,
      visit_count = visit_count + 1
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;

  PERFORM insert_audit_log('order.completed', 'order', v_order_id::text, p_store_id,
    jsonb_build_object('order_number', v_order_number, 'total', v_total));

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_checkout TO authenticated;
GRANT EXECUTE ON FUNCTION convert_unit TO authenticated;
GRANT EXECUTE ON FUNCTION compute_recipe_cost TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_costs TO authenticated;
