-- Product modifier catalog + kitchen display status on orders.

CREATE TABLE IF NOT EXISTS product_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_select INT NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INT NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_modifier_groups_max_gte_min CHECK (max_select >= min_select)
);

CREATE INDEX IF NOT EXISTS product_modifier_groups_product_idx
  ON product_modifier_groups (product_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_modifiers_group_idx
  ON product_modifiers (group_id)
  WHERE is_active;

ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_modifier_groups_org ON product_modifier_groups;
CREATE POLICY product_modifier_groups_org ON product_modifier_groups
  FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS product_modifiers_org ON product_modifiers;
CREATE POLICY product_modifiers_org ON product_modifiers
  FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- Kitchen queue status (nullable = not on KDS / not food-service)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_kitchen_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_kitchen_status_check
  CHECK (
    kitchen_status IS NULL
    OR kitchen_status IN ('queued', 'preparing', 'ready', 'served')
  );

CREATE INDEX IF NOT EXISTS orders_kitchen_status_store_idx
  ON orders (store_id, kitchen_status, created_at DESC)
  WHERE kitchen_status IS NOT NULL
    AND status = 'completed';

-- Scale device registry (supermarket) — store/device scoped settings JSON
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS scale_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS scale_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN devices.scale_enabled IS
  'When true, POS may use scale hook for weight products on this terminal';
COMMENT ON COLUMN devices.scale_settings IS
  'Protocol/config for reference scale (e.g. { "protocol": "manual", "unit": "kg" })';
