-- Fix null subtotal on checkout.
-- Assign resolve_product_unit_price outputs directly (avoid RECORD field access),
-- and guard before INSERT so checkout cannot write a null subtotal.

CREATE OR REPLACE FUNCTION public.complete_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_warehouse_id UUID;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC;
  v_line JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_qty NUMERIC;
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
  v_business JSONB := '{}'::jsonb;
  v_activity business_activity_type := 'retail';
  v_auto_wholesale BOOLEAN := false;
  v_recipes_enabled BOOLEAN;
  v_recipe_id UUID;
  v_order_item_id UUID;
  v_ingredient RECORD;
  v_deduct_qty NUMERIC;
  v_ingredient_cost NUMERIC;
  v_deduction_cost NUMERIC;
  v_session_settings JSONB;
  v_max_open_hours NUMERIC := 24;
  v_block_sales_when_expired BOOLEAN := true;
  v_session_opened_at TIMESTAMPTZ;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_sale_unit measurement_unit;
  v_base_unit measurement_unit;
  v_base_qty NUMERIC;
  v_tier_id UUID;
  v_wholesale_applied BOOLEAN;
  v_sale_input_mode weight_sale_input_mode;
  v_entered_amount NUMERIC;
  v_sales_unit_type product_sales_unit_type;
  v_resolved_tier_id UUID;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_cashier_id IS DISTINCT FROM v_caller AND NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;

  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF is_period_closed(p_store_id, now()) THEN RAISE EXCEPTION 'Period is closed for this date'; END IF;

  SELECT id INTO v_warehouse_id FROM warehouses
  WHERE store_id = p_store_id AND is_default = true AND is_active = true
  LIMIT 1;
  IF v_warehouse_id IS NULL THEN RAISE EXCEPTION 'Default warehouse not found'; END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_recipes_enabled := COALESCE((v_flags->>'recipes')::boolean, false);

  SELECT value INTO v_business FROM app_settings WHERE org_id = v_org_id AND key = 'business_activity' LIMIT 1;
  v_business := COALESCE(v_business, '{}'::jsonb);
  v_activity := COALESCE((v_business->>'activity_type')::business_activity_type, 'retail'::business_activity_type);
  v_auto_wholesale := COALESCE((v_business->>'auto_apply_wholesale_by_quantity')::boolean, false);

  IF p_sales_mode = 'wholesale' AND COALESCE((v_flags->>'wholesale_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Wholesale sales are disabled';
  END IF;

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
  IF p_payment_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
    RAISE EXCEPTION 'Wallet payments are disabled';
  END IF;
  IF p_payment_method = 'credit' AND COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Credit sales are disabled';
  END IF;
  IF p_payment_method = 'credit' AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
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

  -- Same open session may continue on any active paired device for this store.
  IF p_device_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM devices d
    WHERE d.id = p_device_id
      AND d.is_active = true
      AND d.store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Device is not valid for this store';
  END IF;

  SELECT value INTO v_session_settings FROM app_settings
  WHERE org_id = v_org_id AND key = 'session_settings' LIMIT 1;
  v_session_settings := COALESCE(v_session_settings, '{}'::jsonb);
  v_max_open_hours := COALESCE((v_session_settings->>'max_open_hours')::numeric, 24);
  v_block_sales_when_expired := COALESCE((v_session_settings->>'block_sales_when_expired')::boolean, true);

  SELECT opened_at INTO v_session_opened_at FROM cashier_sessions WHERE id = p_session_id;
  IF v_block_sales_when_expired
    AND v_session_opened_at IS NOT NULL
    AND v_session_opened_at + (v_max_open_hours || ' hours')::interval <= now()
  THEN
    RAISE EXCEPTION 'Session expired — close shift to continue';
  END IF;

  IF COALESCE((v_flags->>'tax')::boolean, true) THEN
    SELECT value INTO v_setting FROM app_settings WHERE org_id = v_org_id AND key = 'tax_rate' LIMIT 1;
    IF v_setting IS NOT NULL THEN
      v_tax_rate := COALESCE((v_setting->>'rate')::numeric, 0);
    END IF;
  END IF;

  v_order_number := 'SF-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
    lpad((
      SELECT COUNT(*) + 1 FROM orders
      WHERE store_id = p_store_id AND created_at::date = now()::date
    )::text, 4, '0');

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_sale_input_mode := NULLIF(v_line->>'sale_input_mode', '')::weight_sale_input_mode;
    v_entered_amount := COALESCE((v_line->>'entered_amount')::numeric, 0);
    IF v_qty <= 0 AND v_sale_input_mode IS DISTINCT FROM 'by_amount' THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    IF v_sale_input_mode = 'by_amount' THEN
      IF COALESCE((v_flags->>'price_by_amount')::boolean, false) = false THEN
        RAISE EXCEPTION 'Price by amount sales are disabled';
      END IF;
      IF v_entered_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
    END IF;

    SELECT p.track_inventory, p.name, p.product_type, p.sale_unit, p.unit, p.sales_unit_type, p.base_price
    INTO v_track, v_product_name, v_product_type, v_sale_unit, v_base_unit, v_sales_unit_type, v_unit_price
    FROM products p
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_product_type = 'ingredient' THEN
      RAISE EXCEPTION 'Ingredient products cannot be sold directly';
    END IF;

    IF v_sales_unit_type IN ('weight', 'mixed')
      AND COALESCE((v_flags->>'weight_sales')::boolean, false) = false
      AND v_sale_input_mode IS NOT NULL
    THEN
      RAISE EXCEPTION 'Weight sales are disabled';
    END IF;

    IF v_sale_input_mode = 'by_amount' THEN
      v_qty := round(v_entered_amount / NULLIF(v_unit_price, 0), 4);
      IF v_qty <= 0 THEN RAISE EXCEPTION 'Invalid amount for unit price'; END IF;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      v_qty := COALESCE(
        (
          SELECT pv.quantity_value
          FROM product_variants pv
          WHERE pv.id = v_variant_id
            AND pv.product_id = v_product_id
            AND pv.variant_kind = 'weight_portion'
        ),
        v_qty
      );
    END IF;

    SELECT r.unit_price, r.tier_id, r.wholesale_applied
    INTO v_unit_price, v_tier_id, v_wholesale_applied
    FROM resolve_product_unit_price(
      v_org_id, v_product_id, v_variant_id, v_qty, v_sale_unit, p_sales_mode, v_auto_wholesale
    ) r;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Could not resolve unit price for % (qty=%, variant=%)', v_product_name, v_qty, v_variant_id;
    END IF;
    v_wholesale_applied := COALESCE(v_wholesale_applied, false);

    IF EXISTS (
      SELECT 1 FROM product_variants
      WHERE product_id = v_product_id AND is_active = true AND variant_kind = 'standard'
    ) AND v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Variant required for %', v_product_name;
    END IF;

    IF v_variant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid variant for %', v_product_name;
    END IF;

    v_line_total := round(v_unit_price * v_qty, 2);
    v_subtotal := COALESCE(v_subtotal, 0) + COALESCE(v_line_total, 0);
    v_base_qty := convert_unit(v_qty, v_sale_unit, v_base_unit);

    v_recipe_id := NULL;
    IF v_recipes_enabled THEN
      v_recipe_id := resolve_product_recipe_id(v_product_id, v_variant_id);
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
          WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL
          FOR UPDATE;
          IF v_stock_qty IS NULL OR v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %', v_ingredient.ing_name;
          END IF;
        END IF;
      END LOOP;
    ELSIF v_track AND COALESCE((v_flags->>'prevent_negative_stock')::boolean, true) THEN
      SELECT quantity INTO v_stock_qty FROM stock_levels
      WHERE warehouse_id = v_warehouse_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id)
      FOR UPDATE;
      IF v_stock_qty IS NULL OR v_stock_qty < v_base_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_product_name;
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Checkout lines are required';
  END IF;
  IF v_subtotal IS NULL THEN
    RAISE EXCEPTION 'Order subtotal could not be calculated from lines: %', p_lines;
  END IF;
  v_tax := round(v_subtotal * COALESCE(v_tax_rate, 0), 2);
  v_total := greatest(0, v_subtotal - COALESCE(p_discount, 0) + COALESCE(v_tax, 0));

  INSERT INTO orders (
    store_id, session_id, order_number, customer_id, status,
    subtotal, discount, tax, total, payment_status, created_by,
    sales_mode, activity_type
  ) VALUES (
    p_store_id, p_session_id, v_order_number, p_customer_id, 'completed',
    v_subtotal, COALESCE(p_discount, 0), v_tax, v_total, 'paid', p_cashier_id,
    p_sales_mode, v_activity
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_sale_input_mode := NULLIF(v_line->>'sale_input_mode', '')::weight_sale_input_mode;
    v_entered_amount := COALESCE((v_line->>'entered_amount')::numeric, 0);
    v_tier_id := NULLIF(v_line->>'tier_id', '')::uuid;

    SELECT p.track_inventory, p.name, p.sale_unit, p.unit, p.base_price
    INTO v_track, v_product_name, v_sale_unit, v_base_unit, v_unit_price
    FROM products p
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    IF v_sale_input_mode = 'by_amount' AND v_entered_amount > 0 THEN
      v_qty := round(v_entered_amount / NULLIF(v_unit_price, 0), 4);
    END IF;

    IF v_variant_id IS NOT NULL THEN
      v_qty := COALESCE(
        (
          SELECT pv.quantity_value
          FROM product_variants pv
          WHERE pv.id = v_variant_id
            AND pv.product_id = v_product_id
            AND pv.variant_kind = 'weight_portion'
        ),
        v_qty
      );
    END IF;

    SELECT r.unit_price, r.tier_id, r.wholesale_applied
    INTO v_unit_price, v_resolved_tier_id, v_wholesale_applied
    FROM resolve_product_unit_price(
      v_org_id, v_product_id, v_variant_id, v_qty, v_sale_unit, p_sales_mode, v_auto_wholesale
    ) r;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Could not resolve unit price for %', v_product_name;
    END IF;
    v_tier_id := COALESCE(v_tier_id, v_resolved_tier_id);
    v_wholesale_applied := COALESCE(v_wholesale_applied, false);
    v_line_total := round(v_unit_price * v_qty, 2);
    v_base_qty := convert_unit(v_qty, v_sale_unit, v_base_unit);
    v_line_cost := 0;
    v_unit_cost := 0;
    v_recipe_id := NULL;

    IF v_recipes_enabled THEN
      v_recipe_id := resolve_product_recipe_id(v_product_id, v_variant_id);
    END IF;

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
        v_line_cost := v_line_cost + v_deduction_cost;
      END LOOP;
      v_unit_cost := CASE WHEN v_qty > 0 THEN round(v_line_cost / v_qty, 4) ELSE 0 END;
    END IF;

    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity, unit_price, modifiers, line_total,
      unit_cost, line_cost, sale_unit, base_quantity, sale_input_mode, tier_id, wholesale_applied
    ) VALUES (
      v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price, '[]'::jsonb, v_line_total,
      v_unit_cost, v_line_cost, v_sale_unit, v_base_qty, v_sale_input_mode, v_tier_id, v_wholesale_applied
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
        WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL;

        INSERT INTO inventory_movements (
          store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
          reference_type, reference_id, created_by
        ) VALUES (
          p_store_id, v_warehouse_id, v_ingredient.ing_id, NULL, 'sale', -v_deduct_qty,
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
      UPDATE stock_levels SET quantity = quantity - v_base_qty, updated_at = now()
      WHERE warehouse_id = v_warehouse_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id);

      INSERT INTO inventory_movements (
        store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
        reference_type, reference_id, created_by
      ) VALUES (
        p_store_id, v_warehouse_id, v_product_id, v_variant_id, 'sale', -v_base_qty,
        'order', v_order_id, p_cashier_id
      );
    END IF;
  END LOOP;

  IF p_payment_method = 'credit' THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_total) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;
  END IF;

  INSERT INTO order_payments (order_id, method, amount)
  VALUES (v_order_id, p_payment_method, v_total);

  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_spent = total_spent + v_total,
      visit_count = visit_count + 1
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;
  IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_total, 0, v_order_id, v_order_number, p_cashier_id
    );
    UPDATE customers
    SET account_balance = account_balance + v_total
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;

  PERFORM insert_audit_log('order.completed', 'order', v_order_id::text, p_store_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'total', v_total,
      'warehouse_id', v_warehouse_id,
      'sales_mode', p_sales_mode,
      'activity_type', v_activity
    ));

  IF p_sales_mode = 'wholesale' THEN
    PERFORM insert_audit_log('order.wholesale_sale', 'order', v_order_id::text, p_store_id,
      jsonb_build_object('order_number', v_order_number));
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions';
