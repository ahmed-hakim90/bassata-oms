-- Document date for sales invoices + purchases (backdating).
-- Operator-chosen calendar date on draft; stock/AR/AP timestamps follow it on post.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS document_date DATE;

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS document_date DATE;

UPDATE public.orders
SET document_date = (created_at AT TIME ZONE 'UTC')::date
WHERE document_date IS NULL;

-- Feature-gate trigger blocks UPDATE without session auth; disable for backfill only.
ALTER TABLE public.purchase_invoices DISABLE TRIGGER purchases_require_feature;

UPDATE public.purchase_invoices
SET document_date = COALESCE(
  (received_at AT TIME ZONE 'UTC')::date,
  (created_at AT TIME ZONE 'UTC')::date
)
WHERE document_date IS NULL;

ALTER TABLE public.purchase_invoices ENABLE TRIGGER purchases_require_feature;

ALTER TABLE public.orders
  ALTER COLUMN document_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN document_date SET NOT NULL;

ALTER TABLE public.purchase_invoices
  ALTER COLUMN document_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN document_date SET NOT NULL;

COMMENT ON COLUMN public.orders.document_date IS
  'Business/document calendar date. For sales invoices editable on draft; used for issue/deliver/stock/AR stamping.';
COMMENT ON COLUMN public.purchase_invoices.document_date IS
  'Business/document calendar date. Editable on draft; used for receive/stock/AP stamping.';

CREATE INDEX IF NOT EXISTS idx_orders_store_document_date
  ON public.orders (store_id, document_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_store_document_date
  ON public.purchase_invoices (store_id, document_date DESC);


CREATE OR REPLACE FUNCTION public.issue_sales_invoice(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_order RECORD;
  v_line_count INT;
  v_business JSONB := '{}'::jsonb;
  v_at TIMESTAMPTZ;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF NOT (
    has_permission('checkout_create')
    OR is_privileged_role()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT o.*
  INTO v_order
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT has_store_access(v_order.store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF v_order.document_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft sales invoices can be issued';
  END IF;
  IF v_order.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Invalid order status for issue';
  END IF;
  IF v_order.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sales invoices must be sessionless';
  END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_business
  FROM app_settings
  WHERE org_id = v_org_id AND key = 'business_activity'
  LIMIT 1;

  IF v_order.sales_mode = 'wholesale'
     AND COALESCE((v_business->>'enable_wholesale_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Wholesale sales are disabled';
  END IF;

  IF auth_user_role() = 'cashier'
     AND v_order.sales_mode = 'wholesale'
     AND COALESCE((v_business->>'allow_cashier_wholesale')::boolean, false) = false THEN
    RAISE EXCEPTION 'Cashier wholesale sales are not allowed';
  END IF;

  SELECT COUNT(*) INTO v_line_count FROM order_items WHERE order_id = p_order_id;
  IF v_line_count < 1 THEN RAISE EXCEPTION 'Add at least one line before issuing'; END IF;
  IF COALESCE(v_order.total, 0) <= 0 THEN RAISE EXCEPTION 'Invoice total must be greater than zero'; END IF;

  v_at := (COALESCE(v_order.document_date, CURRENT_DATE)::timestamp + TIME '12:00') AT TIME ZONE 'UTC';

  UPDATE orders
  SET document_status = 'issued',
      issued_at = v_at
  WHERE id = p_order_id;

  PERFORM insert_audit_log(
    'order.sales_invoice_issued',
    'order',
    p_order_id::text,
    v_order.store_id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'sales_mode', v_order.sales_mode,
      'total', v_order.total
    )
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'document_status', 'issued',
    'issued_at', v_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- deliver_sales_invoice: issued → delivered + stock deduction + optional payment
-- p_payment_method NULL = leave unpaid (customer required)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deliver_sales_invoice(
  p_order_id UUID,
  p_payment_method public.payment_method DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_order RECORD;
  v_warehouse_id UUID;
  v_flags JSONB := '{}'::jsonb;
  v_business JSONB := '{}'::jsonb;
  v_item RECORD;
  v_track BOOLEAN;
  v_stock_qty NUMERIC;
  v_product_name TEXT;
  v_product_type product_type;
  v_base_qty NUMERIC;
  v_recipes_enabled BOOLEAN;
  v_prevent_negative BOOLEAN;
  v_recipe_id UUID;
  v_ingredient RECORD;
  v_deduct_qty NUMERIC;
  v_ingredient_cost NUMERIC;
  v_deduction_cost NUMERIC;
  v_line_cost NUMERIC;
  v_unit_cost NUMERIC;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_payment_status payment_status;
  v_at TIMESTAMPTZ;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF NOT (
    has_permission('checkout_create')
    OR is_privileged_role()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT o.*
  INTO v_order
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT has_store_access(v_order.store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  v_at := (COALESCE(v_order.document_date, CURRENT_DATE)::timestamp + TIME '12:00') AT TIME ZONE 'UTC';

  IF is_period_closed(v_order.store_id, v_at) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;
  IF v_order.document_status IS DISTINCT FROM 'issued' THEN
    RAISE EXCEPTION 'Only issued sales invoices can be delivered';
  END IF;
  IF v_order.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Invalid order status for deliver';
  END IF;
  IF v_order.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sales invoices must be sessionless';
  END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_flags
  FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  SELECT COALESCE(value, '{}'::jsonb) INTO v_business
  FROM app_settings WHERE org_id = v_org_id AND key = 'business_activity' LIMIT 1;

  IF COALESCE((v_flags->>'inventory_deduction')::boolean, true) = false THEN
    RAISE EXCEPTION 'Inventory deduction is disabled';
  END IF;

  IF v_order.sales_mode = 'wholesale'
     AND COALESCE((v_business->>'enable_wholesale_sales')::boolean, false) = false
     AND COALESCE((v_flags->>'wholesale_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Wholesale sales are disabled';
  END IF;

  IF auth_user_role() = 'cashier'
     AND v_order.sales_mode = 'wholesale'
     AND COALESCE((v_business->>'allow_cashier_wholesale')::boolean, false) = false THEN
    RAISE EXCEPTION 'Cashier wholesale sales are not allowed';
  END IF;

  IF p_payment_method IS NULL AND v_order.customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for unpaid delivery';
  END IF;
  IF p_payment_method = 'credit' AND v_order.customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;
  IF p_payment_method = 'credit'
     AND COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
    RAISE EXCEPTION 'Credit sales are disabled';
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

  v_warehouse_id := v_order.warehouse_id;
  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id FROM warehouses
    WHERE store_id = v_order.store_id AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;
  IF v_warehouse_id IS NULL THEN RAISE EXCEPTION 'Default warehouse not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = v_warehouse_id AND store_id = v_order.store_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Warehouse is not valid for this store';
  END IF;

  v_recipes_enabled := COALESCE((v_flags->>'recipes')::boolean, false);
  v_prevent_negative := COALESCE((v_flags->>'prevent_negative_stock')::boolean, true);

  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Invoice has no lines';
  END IF;
  IF COALESCE(v_order.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Invoice total must be greater than zero';
  END IF;

  IF p_payment_method = 'credit' THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = v_order.customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_order.total) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;
  END IF;

  -- Pass 1: validate stock + compute costs
  FOR v_item IN
    SELECT oi.*
    FROM order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.id
  LOOP
    SELECT p.track_inventory, p.name, p.product_type
    INTO v_track, v_product_name, v_product_type
    FROM products p
    WHERE p.id = v_item.product_id AND p.org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

    v_base_qty := COALESCE(NULLIF(v_item.base_quantity, 0), v_item.quantity);
    v_line_cost := 0;
    v_unit_cost := 0;
    v_recipe_id := NULL;

    IF v_recipes_enabled THEN
      v_recipe_id := resolve_product_recipe_id(v_item.product_id, v_item.variant_id);
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
        v_deduct_qty := convert_unit(
          v_ingredient.recipe_qty * v_item.quantity,
          v_ingredient.recipe_unit,
          v_ingredient.stock_unit
        );
        IF v_prevent_negative THEN
          SELECT quantity INTO v_stock_qty FROM stock_levels
          WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL
          FOR UPDATE;
          IF v_stock_qty IS NULL OR v_stock_qty < v_deduct_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %', v_ingredient.ing_name;
          END IF;
        END IF;
        v_ingredient_cost := convert_unit(
          v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit
        ) * v_ingredient.last_unit_cost;
        v_deduction_cost := round(v_ingredient_cost * v_item.quantity, 2);
        v_line_cost := v_line_cost + v_deduction_cost;
      END LOOP;
      v_unit_cost := CASE WHEN v_item.quantity > 0 THEN round(v_line_cost / v_item.quantity, 4) ELSE 0 END;
    ELSIF v_track AND v_prevent_negative THEN
      SELECT quantity INTO v_stock_qty FROM stock_levels
      WHERE warehouse_id = v_warehouse_id AND product_id = v_item.product_id
        AND (variant_id IS NOT DISTINCT FROM v_item.variant_id)
      FOR UPDATE;
      IF v_stock_qty IS NULL OR v_stock_qty < v_base_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_product_name;
      END IF;
      SELECT last_unit_cost INTO v_unit_cost FROM products WHERE id = v_item.product_id;
      v_unit_cost := COALESCE(v_unit_cost, 0);
      v_line_cost := round(v_unit_cost * v_base_qty, 2);
    ELSIF v_track THEN
      SELECT last_unit_cost INTO v_unit_cost FROM products WHERE id = v_item.product_id;
      v_unit_cost := COALESCE(v_unit_cost, 0);
      v_line_cost := round(v_unit_cost * v_base_qty, 2);
    END IF;

    UPDATE order_items
    SET unit_cost = COALESCE(v_unit_cost, 0),
        line_cost = COALESCE(v_line_cost, 0),
        base_quantity = v_base_qty
    WHERE id = v_item.id;
  END LOOP;

  -- Pass 2: apply deductions
  FOR v_item IN
    SELECT oi.*
    FROM order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.id
  LOOP
    SELECT p.track_inventory INTO v_track
    FROM products p WHERE p.id = v_item.product_id;

    v_base_qty := COALESCE(NULLIF(v_item.base_quantity, 0), v_item.quantity);
    v_recipe_id := NULL;
    IF v_recipes_enabled THEN
      v_recipe_id := resolve_product_recipe_id(v_item.product_id, v_item.variant_id);
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
        v_deduct_qty := convert_unit(
          v_ingredient.recipe_qty * v_item.quantity,
          v_ingredient.recipe_unit,
          v_ingredient.stock_unit
        );
        v_ingredient_cost := convert_unit(
          v_ingredient.recipe_qty, v_ingredient.recipe_unit, v_ingredient.cost_unit
        ) * v_ingredient.last_unit_cost;
        v_deduction_cost := round(v_ingredient_cost * v_item.quantity, 2);

        INSERT INTO stock_levels (
          store_id, warehouse_id, product_id, variant_id, quantity, reorder_point, updated_at
        ) VALUES (
          v_order.store_id, v_warehouse_id, v_ingredient.ing_id, NULL, -v_deduct_qty, 10, now()
        )
        ON CONFLICT (
          warehouse_id,
          product_id,
          (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
        )
        DO UPDATE SET quantity = stock_levels.quantity - v_deduct_qty, updated_at = now();

        INSERT INTO inventory_movements (
          store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
          reference_type, reference_id, created_by, created_at
        ) VALUES (
          v_order.store_id, v_warehouse_id, v_ingredient.ing_id, NULL, 'sale', -v_deduct_qty,
          'order', p_order_id, v_caller, v_at
        );

        INSERT INTO order_item_deductions (
          order_item_id, ingredient_product_id, quantity, unit, unit_cost, line_cost
        ) VALUES (
          v_item.id,
          v_ingredient.ing_id,
          convert_unit(v_ingredient.recipe_qty * v_item.quantity, v_ingredient.recipe_unit, v_ingredient.recipe_unit),
          v_ingredient.recipe_unit,
          round(v_ingredient_cost, 4),
          v_deduction_cost
        );
      END LOOP;
    ELSIF COALESCE(v_track, false) THEN
      INSERT INTO stock_levels (
        store_id, warehouse_id, product_id, variant_id, quantity, reorder_point, updated_at
      ) VALUES (
        v_order.store_id, v_warehouse_id, v_item.product_id, v_item.variant_id, -v_base_qty, 10, now()
      )
      ON CONFLICT (
        warehouse_id,
        product_id,
        (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
      )
      DO UPDATE SET quantity = stock_levels.quantity - v_base_qty, updated_at = now();

      INSERT INTO inventory_movements (
        store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
        reference_type, reference_id, created_by, created_at
      ) VALUES (
        v_order.store_id, v_warehouse_id, v_item.product_id, v_item.variant_id,
        'sale', -v_base_qty, 'order', p_order_id, v_caller, v_at
      );
    END IF;
  END LOOP;

  IF p_payment_method IS NULL THEN
    v_payment_status := 'unpaid';
  ELSIF p_payment_method = 'credit' THEN
    v_payment_status := 'unpaid';
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (p_order_id, 'credit', v_order.total);
    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by, created_at
    ) VALUES (
      v_org_id, v_order.store_id, v_order.customer_id, 'credit_sale',
      v_order.total, 0, p_order_id, v_order.order_number, v_caller, v_at
    );
    UPDATE customers
    SET account_balance = account_balance + v_order.total,
        total_spent = total_spent + v_order.total,
        visit_count = visit_count + 1
    WHERE id = v_order.customer_id AND org_id = v_org_id;
  ELSE
    v_payment_status := 'paid';
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (p_order_id, p_payment_method, v_order.total);
    IF v_order.customer_id IS NOT NULL THEN
      UPDATE customers
      SET total_spent = total_spent + v_order.total,
          visit_count = visit_count + 1
      WHERE id = v_order.customer_id AND org_id = v_org_id;
    END IF;
  END IF;

  UPDATE orders
  SET document_status = 'delivered',
      delivered_at = v_at,
      status = 'completed',
      payment_status = v_payment_status,
      warehouse_id = v_warehouse_id
  WHERE id = p_order_id;

  PERFORM insert_audit_log(
    'order.sales_invoice_delivered',
    'order',
    p_order_id::text,
    v_order.store_id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'total', v_order.total,
      'warehouse_id', v_warehouse_id,
      'payment_method', p_payment_method,
      'payment_status', v_payment_status,
      'sales_mode', v_order.sales_mode
    )
  );

  IF v_order.sales_mode = 'wholesale' THEN
    PERFORM insert_audit_log(
      'order.wholesale_sale',
      'order',
      p_order_id::text,
      v_order.store_id,
      jsonb_build_object('order_number', v_order.order_number, 'via', 'sales_invoice')
    );
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'document_status', 'delivered',
    'status', 'completed',
    'payment_status', v_payment_status,
    'delivered_at', v_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_sales_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_sales_invoice(UUID, public.payment_method) TO authenticated;
