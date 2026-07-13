-- Per-SKU purchase packing: how many base units (usually pieces) are in one purchase unit (carton/pack/box).
-- Inventory and POS stay in base_unit; purchases may enter qty/cost in cost_unit then convert.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS units_per_purchase_unit NUMERIC(14,4) NOT NULL DEFAULT 1
    CHECK (units_per_purchase_unit > 0);

COMMENT ON COLUMN products.units_per_purchase_unit IS
  'Number of base_unit quantities in one cost_unit (e.g. 24 pieces per carton). 1 = buy/sell same unit.';

COMMENT ON COLUMN products.cost_unit IS
  'Default purchase packaging unit (piece, carton, pack, box). Converted to base_unit via units_per_purchase_unit.';
