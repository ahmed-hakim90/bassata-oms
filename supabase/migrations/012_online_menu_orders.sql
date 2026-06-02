-- QR online menu intake
CREATE TYPE online_order_status AS ENUM (
  'pending',
  'accepted',
  'preparing',
  'ready',
  'cancelled',
  'invoiced'
);

CREATE TABLE online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status online_order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_online_orders_store_status_created
  ON online_orders(store_id, status, created_at DESC);

CREATE TABLE online_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_order_id UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_online_order_items_order ON online_order_items(online_order_id);

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY online_orders_select ON online_orders FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY online_orders_update ON online_orders FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_orders())
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());
CREATE POLICY online_orders_delete ON online_orders FOR DELETE
  USING (auth_user_role() IN ('owner', 'manager') AND has_store_access(store_id));

CREATE POLICY online_order_items_select ON online_order_items FOR SELECT
  USING (
    online_order_id IN (
      SELECT id FROM online_orders WHERE has_store_access(store_id)
    )
  );

CREATE POLICY online_order_items_mutate ON online_order_items FOR ALL
  USING (
    online_order_id IN (
      SELECT id FROM online_orders WHERE has_store_access(store_id) AND can_mutate_orders()
    )
  )
  WITH CHECK (
    online_order_id IN (
      SELECT id FROM online_orders WHERE has_store_access(store_id) AND can_mutate_orders()
    )
  );

UPDATE stores
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object('online_menu_token', replace(id::text, '-', ''))
WHERE NOT COALESCE(settings, '{}'::jsonb) ? 'online_menu_token';

CREATE OR REPLACE FUNCTION trg_online_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER online_orders_updated_at
  BEFORE UPDATE ON online_orders
  FOR EACH ROW EXECUTE FUNCTION trg_online_orders_updated_at();

CREATE OR REPLACE FUNCTION complete_unpaid_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_discount NUMERIC,
  p_lines JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
BEGIN
  v_result := complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    'cash'::payment_method,
    p_discount,
    p_lines
  );
  v_order_id := (v_result->>'order_id')::uuid;

  DELETE FROM order_payments WHERE order_id = v_order_id;
  UPDATE orders SET payment_status = 'unpaid' WHERE id = v_order_id;

  PERFORM insert_audit_log('order.created_unpaid', 'order', v_order_id::text, p_store_id, v_result);
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_unpaid_checkout TO authenticated;
