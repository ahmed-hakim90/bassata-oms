-- Atomic online-order intake, editing, reservation and checkout linkage.

CREATE UNIQUE INDEX IF NOT EXISTS online_orders_order_id_unique
  ON public.online_orders(order_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_online_order_atomic(
  p_order JSONB,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.online_orders%ROWTYPE;
  v_store_org UUID;
BEGIN
  IF current_user <> 'service_role' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Online order items must contain between 1 and 50 lines';
  END IF;

  SELECT org_id INTO v_store_org
  FROM stores
  WHERE id = (p_order->>'store_id')::uuid AND is_active = true;
  IF v_store_org IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS i(product_id UUID, variant_id UUID)
    LEFT JOIN products p ON p.id = i.product_id AND p.org_id = v_store_org
    LEFT JOIN product_variants pv
      ON pv.id = i.variant_id AND pv.product_id = i.product_id
    WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND pv.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Online order contains products outside the store organization';
  END IF;

  INSERT INTO online_orders (
    store_id, customer_name, customer_phone, notes, subtotal, total, discount,
    promo_discount, coupon_code, tax, status, fulfillment_type, delivery_area,
    delivery_address, delivery_fee
  ) VALUES (
    (p_order->>'store_id')::uuid,
    trim(p_order->>'customer_name'),
    NULLIF(trim(COALESCE(p_order->>'customer_phone', '')), ''),
    trim(COALESCE(p_order->>'notes', '')),
    COALESCE((p_order->>'subtotal')::numeric, 0),
    COALESCE((p_order->>'total')::numeric, 0),
    COALESCE((p_order->>'discount')::numeric, 0),
    COALESCE((p_order->>'promo_discount')::numeric, 0),
    NULLIF(upper(trim(COALESCE(p_order->>'coupon_code', ''))), ''),
    COALESCE((p_order->>'tax')::numeric, 0),
    'pending',
    NULLIF(p_order->>'fulfillment_type', ''),
    COALESCE(p_order->>'delivery_area', ''),
    COALESCE(p_order->>'delivery_address', ''),
    COALESCE((p_order->>'delivery_fee')::numeric, 0)
  ) RETURNING * INTO v_order;

  INSERT INTO online_order_items (
    online_order_id, product_id, variant_id, product_name, variant_name,
    quantity, unit_price, line_total, list_unit_price, discount_amount,
    promotion_rule_id
  )
  SELECT
    v_order.id, i.product_id, i.variant_id, i.product_name, i.variant_name,
    i.quantity, i.unit_price, i.line_total, i.list_unit_price,
    COALESCE(i.discount_amount, 0), i.promotion_rule_id
  FROM jsonb_to_recordset(p_items) AS i(
    product_id UUID,
    variant_id UUID,
    product_name TEXT,
    variant_name TEXT,
    quantity INT,
    unit_price NUMERIC,
    line_total NUMERIC,
    list_unit_price NUMERIC,
    discount_amount NUMERIC,
    promotion_rule_id UUID
  );

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_order_atomic(JSONB, JSONB) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_online_order_atomic(JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.update_online_order_details_atomic(
  p_online_order_id UUID,
  p_order JSONB,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.online_orders%ROWTYPE;
  v_org_id UUID;
BEGIN
  IF auth_app_user_id() IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Online order items must contain between 1 and 50 lines';
  END IF;

  SELECT oo.* INTO v_order
  FROM online_orders oo
  WHERE oo.id = p_online_order_id
  FOR UPDATE OF oo;
  IF v_order.id IS NULL OR NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Online order not found';
  END IF;
  SELECT org_id INTO v_org_id FROM stores WHERE id = v_order.store_id;
  IF v_order.status IN ('cancelled', 'invoiced') THEN
    RAISE EXCEPTION 'Online order cannot be edited';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS i(product_id UUID, variant_id UUID)
    LEFT JOIN products p ON p.id = i.product_id AND p.org_id = v_org_id
    LEFT JOIN product_variants pv
      ON pv.id = i.variant_id AND pv.product_id = i.product_id
    WHERE p.id IS NULL OR (i.variant_id IS NOT NULL AND pv.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Online order contains invalid products';
  END IF;

  UPDATE online_orders SET
    customer_name = trim(p_order->>'customer_name'),
    customer_phone = NULLIF(trim(COALESCE(p_order->>'customer_phone', '')), ''),
    notes = trim(COALESCE(p_order->>'notes', '')),
    subtotal = COALESCE((p_order->>'subtotal')::numeric, 0),
    total = COALESCE((p_order->>'total')::numeric, 0),
    discount = COALESCE((p_order->>'discount')::numeric, 0),
    tax = COALESCE((p_order->>'tax')::numeric, 0)
  WHERE id = p_online_order_id
  RETURNING * INTO v_order;

  DELETE FROM online_order_items WHERE online_order_id = p_online_order_id;
  INSERT INTO online_order_items (
    online_order_id, product_id, variant_id, product_name, variant_name,
    quantity, unit_price, line_total
  )
  SELECT
    p_online_order_id, i.product_id, i.variant_id, i.product_name,
    i.variant_name, i.quantity, i.unit_price, i.line_total
  FROM jsonb_to_recordset(p_items) AS i(
    product_id UUID,
    variant_id UUID,
    product_name TEXT,
    variant_name TEXT,
    quantity INT,
    unit_price NUMERIC,
    line_total NUMERIC
  );

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.update_online_order_details_atomic(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_online_order_details_atomic(UUID, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_online_order_reservation(
  p_online_order_id UUID,
  p_reserve BOOLEAN,
  p_actor_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.online_orders%ROWTYPE;
  v_warehouse_id UUID;
  v_org_id UUID;
  v_prevent_negative BOOLEAN := true;
  v_line RECORD;
  v_held NUMERIC;
  v_delta NUMERIC;
  v_stock NUMERIC;
  v_updated INT;
BEGIN
  IF auth_app_user_id() IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF p_actor_id IS DISTINCT FROM auth_app_user_id()
     AND auth_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  SELECT oo.* INTO v_order
  FROM online_orders oo
  WHERE oo.id = p_online_order_id
  FOR UPDATE OF oo;
  IF v_order.id IS NULL OR NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Online order not found';
  END IF;
  SELECT org_id INTO v_org_id FROM stores WHERE id = v_order.store_id;

  SELECT id INTO v_warehouse_id
  FROM warehouses
  WHERE store_id = v_order.store_id AND is_default = true AND is_active = true
  LIMIT 1;
  IF v_warehouse_id IS NULL THEN RAISE EXCEPTION 'Default warehouse not found'; END IF;

  SELECT COALESCE((value->>'prevent_negative_stock')::boolean, true)
  INTO v_prevent_negative
  FROM app_settings
  WHERE org_id = v_org_id AND key = 'feature_flags'
  LIMIT 1;
  v_prevent_negative := COALESCE(v_prevent_negative, true);

  FOR v_line IN
    SELECT i.product_id, i.variant_id, SUM(i.quantity)::numeric AS quantity
    FROM online_order_items i
    JOIN products p ON p.id = i.product_id AND p.track_inventory = true
    WHERE i.online_order_id = p_online_order_id
    GROUP BY i.product_id, i.variant_id
    ORDER BY i.product_id, i.variant_id NULLS FIRST
  LOOP
    SELECT GREATEST(0, -COALESCE(SUM(im.quantity_delta), 0))
    INTO v_held
    FROM inventory_movements im
    WHERE im.reference_type = 'online_order'
      AND im.reference_id = p_online_order_id
      AND im.product_id = v_line.product_id
      AND im.variant_id IS NOT DISTINCT FROM v_line.variant_id
      AND im.movement_type IN ('reservation', 'reservation_release');

    v_delta := CASE
      WHEN p_reserve THEN -GREATEST(0, v_line.quantity - v_held)
      ELSE v_held
    END;
    IF v_delta = 0 THEN CONTINUE; END IF;

    SELECT quantity INTO v_stock
    FROM stock_levels
    WHERE warehouse_id = v_warehouse_id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id
    FOR UPDATE;
    IF v_stock IS NULL THEN RAISE EXCEPTION 'Stock level not found'; END IF;
    IF v_prevent_negative AND v_delta < 0 AND v_stock + v_delta < 0 THEN
      RAISE EXCEPTION 'Insufficient stock';
    END IF;

    UPDATE stock_levels
    SET quantity = quantity + v_delta, updated_at = now()
    WHERE warehouse_id = v_warehouse_id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'Stock level update failed'; END IF;

    INSERT INTO inventory_movements (
      store_id, warehouse_id, product_id, variant_id, movement_type,
      quantity_delta, reference_type, reference_id, reason, created_by
    ) VALUES (
      v_order.store_id, v_warehouse_id, v_line.product_id, v_line.variant_id,
      CASE WHEN p_reserve THEN 'reservation'::movement_type ELSE 'reservation_release'::movement_type END,
      v_delta, 'online_order', p_online_order_id,
      CASE WHEN p_reserve THEN 'حجز طلب أونلاين' ELSE 'تحرير حجز طلب أونلاين' END,
      p_actor_id
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_online_order_reservation(UUID, BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_online_order_reservation(UUID, BOOLEAN, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.invoice_online_order_checkout(
  p_online_order_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_online public.online_orders%ROWTYPE;
  v_lines JSONB;
  v_result JSONB;
BEGIN
  SELECT * INTO v_online
  FROM online_orders
  WHERE id = p_online_order_id
  FOR UPDATE;
  IF v_online.id IS NULL OR NOT has_store_access(v_online.store_id) THEN
    RAISE EXCEPTION 'Online order not found';
  END IF;
  IF v_online.status = 'cancelled' THEN RAISE EXCEPTION 'Online order is cancelled'; END IF;

  -- The row lock makes retries idempotent. A completed earlier attempt returns
  -- its existing invoice rather than creating another one.
  IF v_online.order_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'subtotal', o.subtotal,
      'tax', o.tax,
      'total', o.total,
      'idempotent_replay', true
    ) INTO v_result
    FROM orders o WHERE o.id = v_online.order_id;
    RETURN v_result;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', i.product_id,
    'variant_id', i.variant_id,
    'quantity', i.quantity
  ) ORDER BY i.created_at, i.id)
  INTO v_lines
  FROM online_order_items i
  WHERE i.online_order_id = p_online_order_id;
  IF COALESCE(jsonb_array_length(v_lines), 0) = 0 THEN
    RAISE EXCEPTION 'Online order has no items';
  END IF;

  PERFORM set_online_order_reservation(p_online_order_id, false, p_cashier_id);

  IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 1 THEN
    v_result := complete_checkout_split(
      v_online.store_id, p_session_id, p_cashier_id, p_customer_id,
      p_payment_method, 0, v_lines, p_payments, p_device_id, 'retail', NULL
    );
  ELSE
    v_result := complete_checkout(
      v_online.store_id, p_session_id, p_cashier_id, p_customer_id,
      p_payment_method, 0, v_lines, p_device_id, 'retail', NULL
    );
  END IF;

  UPDATE online_orders
  SET status = 'invoiced', order_id = (v_result->>'order_id')::uuid
  WHERE id = p_online_order_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_online_order_checkout(
  UUID, UUID, UUID, UUID, payment_method, JSONB, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoice_online_order_checkout(
  UUID, UUID, UUID, UUID, payment_method, JSONB, UUID
) TO authenticated;
