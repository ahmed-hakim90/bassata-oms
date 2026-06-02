-- Remaining 003 hardening when 003 was only partially applied (pin_attempts, PIN RPCs, checkout).

CREATE TABLE IF NOT EXISTS pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  attempted_by UUID REFERENCES users(id),
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pin_attempts_select ON pin_attempts;
CREATE POLICY pin_attempts_select ON pin_attempts FOR SELECT
  USING (org_id = auth_org_id() AND is_privileged_role());

DROP POLICY IF EXISTS pin_attempts_no_direct_insert ON pin_attempts;
CREATE POLICY pin_attempts_no_direct_insert ON pin_attempts FOR INSERT
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION set_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id AND org_id = auth_org_id() AND role = 'cashier'
  ) THEN
    RAISE EXCEPTION 'Cashier not found';
  END IF;

  UPDATE pin_codes SET is_active = false WHERE user_id = p_user_id;
  INSERT INTO pin_codes (user_id, pin_hash, is_active)
  VALUES (p_user_id, crypt(p_pin, gen_salt('bf')), true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION set_user_pin TO authenticated;

CREATE OR REPLACE FUNCTION verify_cashier_pin(p_store_id UUID, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
  rec RECORD;
  v_org_id UUID;
  v_attempt_user UUID;
  v_recent_failures INT;
BEGIN
  v_org_id := auth_org_id();
  v_attempt_user := auth_app_user_id();
  IF v_org_id IS NULL OR v_attempt_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  SELECT COUNT(*) INTO v_recent_failures
  FROM pin_attempts
  WHERE org_id = v_org_id
    AND store_id = p_store_id
    AND attempted_by = v_attempt_user
    AND success = false
    AND created_at > now() - interval '10 minutes';

  IF v_recent_failures >= 5 THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.';
  END IF;

  FOR rec IN
    SELECT u.id, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = v_org_id
      AND u.role = 'cashier'
      AND u.is_active = true
  LOOP
    IF rec.pin_hash = crypt(p_pin, rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (v_org_id, p_store_id, v_attempt_user, true);
      RETURN rec.id;
    END IF;
  END LOOP;

  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (v_org_id, p_store_id, v_attempt_user, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_cashier_pin TO authenticated;

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
  v_track BOOLEAN;
  v_stock_qty INT;
  v_product_name TEXT;
  v_today TEXT;
  v_count INT;
  v_tax_rate NUMERIC := 0;
  v_setting JSONB;
  v_flags JSONB := '{}'::jsonb;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF is_period_closed(p_store_id, now()) THEN RAISE EXCEPTION 'Period is closed for this date'; END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
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

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := NULLIF(v_line->>'variant_id', '')::uuid;
    v_qty := (v_line->>'quantity')::int;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT p.base_price + COALESCE(pv.price_delta, 0), p.track_inventory, p.name
    INTO v_unit_price, v_track, v_product_name
    FROM products p
    LEFT JOIN product_variants pv ON pv.id = v_variant_id
    WHERE p.id = v_product_id AND p.org_id = v_org_id AND p.is_active = true;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    IF v_track AND COALESCE((v_flags->>'prevent_negative_stock')::boolean, true) THEN
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

    INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, modifiers, line_total)
    VALUES (v_order_id, v_product_id, v_variant_id, v_qty, v_unit_price, '[]'::jsonb, v_line_total);

    IF v_track THEN
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
