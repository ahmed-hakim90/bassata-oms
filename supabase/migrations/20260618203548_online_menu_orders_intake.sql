-- Online menu order intake.
-- Public customers submit into these tables through a narrow server action.
-- Staff can review, edit, cancel, and convert the intake order into a POS order.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'online_order_status') THEN
    CREATE TYPE online_order_status AS ENUM (
      'pending',
      'accepted',
      'preparing',
      'ready',
      'cancelled',
      'invoiced'
    );
  END IF;
END $$;

ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE online_order_status ADD VALUE IF NOT EXISTS 'invoiced';

CREATE TABLE IF NOT EXISTS online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status online_order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_orders_customer_name_not_blank CHECK (length(trim(customer_name)) > 0),
  CONSTRAINT online_orders_customer_phone_not_blank CHECK (length(trim(customer_phone)) > 0),
  CONSTRAINT online_orders_totals_non_negative CHECK (
    subtotal >= 0 AND discount >= 0 AND tax >= 0 AND total >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_online_orders_store_status_created
  ON online_orders(store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_online_orders_order_id
  ON online_orders(order_id)
  WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS online_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_order_id UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT online_order_items_amounts_non_negative CHECK (unit_price >= 0 AND line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_online_order_items_order
  ON online_order_items(online_order_id);

CREATE INDEX IF NOT EXISTS idx_online_order_items_product
  ON online_order_items(product_id);

UPDATE stores
SET settings = COALESCE(settings, '{}'::jsonb)
  || jsonb_build_object(
    'online_menu_enabled', true,
    'online_menu_ordering_enabled', true
  )
WHERE is_active;

CREATE OR REPLACE FUNCTION trg_online_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS online_orders_updated_at ON online_orders;
CREATE TRIGGER online_orders_updated_at
  BEFORE UPDATE ON online_orders
  FOR EACH ROW EXECUTE FUNCTION trg_online_orders_updated_at();

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS online_orders_select ON online_orders;
DROP POLICY IF EXISTS online_orders_insert ON online_orders;
DROP POLICY IF EXISTS online_orders_update ON online_orders;
DROP POLICY IF EXISTS online_orders_delete ON online_orders;

CREATE POLICY online_orders_select ON online_orders FOR SELECT
  USING (has_store_access(store_id));

CREATE POLICY online_orders_insert ON online_orders FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());

CREATE POLICY online_orders_update ON online_orders FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_orders())
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());

CREATE POLICY online_orders_delete ON online_orders FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS online_order_items_select ON online_order_items;
DROP POLICY IF EXISTS online_order_items_insert ON online_order_items;
DROP POLICY IF EXISTS online_order_items_update ON online_order_items;
DROP POLICY IF EXISTS online_order_items_delete ON online_order_items;

CREATE POLICY online_order_items_select ON online_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM online_orders oo
      WHERE oo.id = online_order_items.online_order_id
        AND has_store_access(oo.store_id)
    )
  );

CREATE POLICY online_order_items_insert ON online_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM online_orders oo
      WHERE oo.id = online_order_items.online_order_id
        AND has_store_access(oo.store_id)
        AND can_mutate_orders()
    )
  );

CREATE POLICY online_order_items_update ON online_order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM online_orders oo
      WHERE oo.id = online_order_items.online_order_id
        AND has_store_access(oo.store_id)
        AND can_mutate_orders()
        AND oo.status NOT IN ('cancelled', 'invoiced')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM online_orders oo
      WHERE oo.id = online_order_items.online_order_id
        AND has_store_access(oo.store_id)
        AND can_mutate_orders()
        AND oo.status NOT IN ('cancelled', 'invoiced')
    )
  );

CREATE POLICY online_order_items_delete ON online_order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM online_orders oo
      WHERE oo.id = online_order_items.online_order_id
        AND has_store_access(oo.store_id)
        AND can_mutate_orders()
        AND oo.status NOT IN ('cancelled', 'invoiced')
    )
  );
