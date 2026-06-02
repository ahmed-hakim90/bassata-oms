-- Production RLS, helpers, audit/PIN RPCs, checkout, period lock support

ALTER TYPE monthly_close_status ADD VALUE IF NOT EXISTS 'reopened';

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Helpers
CREATE OR REPLACE FUNCTION auth_app_user_id() RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_privileged_role() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid() AND role IN ('owner', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_store_access(p_store_id UUID) RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR EXISTS (
      SELECT 1 FROM user_store_access usa
      JOIN users u ON u.id = usa.user_id
      WHERE u.auth_user_id = auth.uid() AND usa.store_id = p_store_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on remaining tables
ALTER TABLE user_store_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Drop baseline policies to replace with consistent patterns
DROP POLICY IF EXISTS stores_org ON stores;
DROP POLICY IF EXISTS users_org ON users;
DROP POLICY IF EXISTS products_org ON products;
DROP POLICY IF EXISTS customers_org ON customers;
DROP POLICY IF EXISTS audit_org ON audit_logs;
DROP POLICY IF EXISTS stock_store ON stock_levels;
DROP POLICY IF EXISTS orders_store ON orders;

-- Organizations
DROP POLICY IF EXISTS org_read ON organizations;
CREATE POLICY org_read ON organizations FOR SELECT
  USING (id = auth_org_id());

-- Stores
CREATE POLICY stores_select ON stores FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY stores_mutate ON stores FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

-- Users
CREATE POLICY users_select ON users FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY users_update_self ON users FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY users_mutate_privileged ON users FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

-- user_store_access
CREATE POLICY usa_select ON user_store_access FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
  );
CREATE POLICY usa_mutate ON user_store_access FOR ALL
  USING (is_privileged_role())
  WITH CHECK (is_privileged_role());

-- pin_codes — no direct access
CREATE POLICY pin_deny ON pin_codes FOR ALL USING (false);

-- devices
CREATE POLICY devices_access ON devices FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

-- Org-scoped catalog
CREATE POLICY categories_org ON categories FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY products_org ON products FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY variants_org ON product_variants FOR ALL
  USING (
    product_id IN (SELECT id FROM products WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    product_id IN (SELECT id FROM products WHERE org_id = auth_org_id())
  );

CREATE POLICY suppliers_org ON suppliers FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY customers_org ON customers FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY loyalty_rules_org ON loyalty_rules FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY app_settings_org ON app_settings FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY import_jobs_org ON import_jobs FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY monthly_closes_org ON monthly_closes FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- Store-scoped
CREATE POLICY stock_store ON stock_levels FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY movements_store ON inventory_movements FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY orders_store ON orders FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY sessions_store ON cashier_sessions FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY expenses_store ON expenses FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY waste_store ON waste_records FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY purchases_store ON purchase_invoices FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY stock_counts_store ON stock_counts FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY transfers_store ON transfer_orders FOR ALL
  USING (has_store_access(from_store_id) AND has_store_access(to_store_id))
  WITH CHECK (has_store_access(from_store_id) AND has_store_access(to_store_id));

-- Child tables
CREATE POLICY order_items_child ON order_items FOR ALL
  USING (
    order_id IN (SELECT id FROM orders WHERE has_store_access(store_id))
  )
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE has_store_access(store_id))
  );

CREATE POLICY order_payments_child ON order_payments FOR ALL
  USING (
    order_id IN (SELECT id FROM orders WHERE has_store_access(store_id))
  )
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE has_store_access(store_id))
  );

CREATE POLICY purchase_lines_child ON purchase_invoice_lines FOR ALL
  USING (
    invoice_id IN (SELECT id FROM purchase_invoices WHERE has_store_access(store_id))
  )
  WITH CHECK (
    invoice_id IN (SELECT id FROM purchase_invoices WHERE has_store_access(store_id))
  );

CREATE POLICY transfer_lines_child ON transfer_order_lines FOR ALL
  USING (
    transfer_id IN (
      SELECT id FROM transfer_orders
      WHERE has_store_access(from_store_id) AND has_store_access(to_store_id)
    )
  )
  WITH CHECK (
    transfer_id IN (
      SELECT id FROM transfer_orders
      WHERE has_store_access(from_store_id) AND has_store_access(to_store_id)
    )
  );

CREATE POLICY stock_count_lines_child ON stock_count_lines FOR ALL
  USING (
    count_id IN (SELECT id FROM stock_counts WHERE has_store_access(store_id))
  )
  WITH CHECK (
    count_id IN (SELECT id FROM stock_counts WHERE has_store_access(store_id))
  );

CREATE POLICY loyalty_ledger_child ON loyalty_ledger FOR ALL
  USING (
    customer_id IN (SELECT id FROM customers WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE org_id = auth_org_id())
  );

-- Audit logs
CREATE POLICY audit_select ON audit_logs FOR SELECT
  USING (
    org_id = auth_org_id()
    AND (
      is_privileged_role()
      OR store_id IS NULL
      OR has_store_access(store_id)
    )
  );

-- Audit insert RPC
CREATE OR REPLACE FUNCTION insert_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_store_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_id UUID;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_store_id IS NOT NULL AND NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  INSERT INTO audit_logs (org_id, store_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_org_id, p_store_id, v_user_id, p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION insert_audit_log TO authenticated;

-- PIN verification RPC (bcrypt via pgcrypto crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_cashier_pin(p_store_id UUID, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
  v_cashier_id UUID;
  rec RECORD;
BEGIN
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  FOR rec IN
    SELECT u.id, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = auth_org_id()
      AND u.role = 'cashier'
      AND u.is_active = true
  LOOP
    IF rec.pin_hash = crypt(p_pin, rec.pin_hash) THEN
      RETURN rec.id;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Invalid PIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_cashier_pin TO authenticated;

-- Period closed check
CREATE OR REPLACE FUNCTION is_period_closed(p_store_id UUID, p_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM monthly_closes mc
    WHERE mc.org_id = auth_org_id()
      AND mc.status = 'closed'
      AND p_at::date >= mc.period_start
      AND p_at::date <= mc.period_end
      AND (mc.store_id IS NULL OR mc.store_id = p_store_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Complete checkout RPC
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
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT has_store_access(p_store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF is_period_closed(p_store_id, now()) THEN RAISE EXCEPTION 'Period is closed for this date'; END IF;

  IF p_session_id IS NULL THEN RAISE EXCEPTION 'Active cashier session required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM cashier_sessions
    WHERE id = p_session_id AND store_id = p_store_id AND status = 'open' AND cashier_id = p_cashier_id
  ) THEN
    RAISE EXCEPTION 'Invalid or closed cashier session';
  END IF;

  SELECT value INTO v_setting FROM app_settings WHERE org_id = v_org_id AND key = 'tax_rate' LIMIT 1;
  IF v_setting IS NOT NULL THEN
    v_tax_rate := COALESCE((v_setting->>'rate')::numeric, 0);
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

    SELECT p.base_price + COALESCE(pv.price_delta, 0), p.track_inventory, p.name
    INTO v_unit_price, v_track, v_product_name
    FROM products p
    LEFT JOIN product_variants pv ON pv.id = v_variant_id
    WHERE p.id = v_product_id AND p.org_id = v_org_id;

    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    IF v_track THEN
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
    WHERE p.id = v_product_id;

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
    WHERE id = p_customer_id;
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
