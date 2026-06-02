-- Generalized inventory architecture foundation for mixed business models.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_tracking_mode') THEN
    CREATE TYPE inventory_tracking_mode AS ENUM (
      'none',
      'standard',
      'batch',
      'batch_and_expiry',
      'serial_number'
    );
  END IF;
END $$;

ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'carton';
ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'box';
ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'pack';
ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'meter';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_rotation_method') THEN
    CREATE TYPE inventory_rotation_method AS ENUM ('FIFO', 'FEFO', 'MANUAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expiry_policy_type') THEN
    CREATE TYPE expiry_policy_type AS ENUM ('block_sale', 'warn_only', 'manager_override');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_product_type') THEN
    CREATE TYPE inventory_product_type AS ENUM (
      'finished_product',
      'raw_material',
      'semi_finished',
      'packaging_material',
      'consumable',
      'service',
      'asset'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_source_type') THEN
    CREATE TYPE batch_source_type AS ENUM (
      'purchase',
      'opening_stock',
      'transfer',
      'production',
      'adjustment'
    );
  END IF;
END $$;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS expiry_tracking_enabled_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_rotation_method_default inventory_rotation_method NOT NULL DEFAULT 'FIFO',
  ADD COLUMN IF NOT EXISTS expiry_policy_default expiry_policy_type NOT NULL DEFAULT 'block_sale';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS inventory_product_type inventory_product_type NOT NULL DEFAULT 'finished_product',
  ADD COLUMN IF NOT EXISTS inventory_tracking_mode inventory_tracking_mode NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS inventory_rotation_method inventory_rotation_method NOT NULL DEFAULT 'FIFO',
  ADD COLUMN IF NOT EXISTS expiry_policy expiry_policy_type NOT NULL DEFAULT 'block_sale',
  ADD COLUMN IF NOT EXISTS expiry_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shelf_life_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shelf_life_months INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shelf_life_years INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_unit measurement_unit NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS supports_weight_sale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_amount_sale BOOLEAN NOT NULL DEFAULT false;

UPDATE products
SET inventory_product_type = CASE
  WHEN product_type = 'ingredient' THEN 'raw_material'::inventory_product_type
  ELSE 'finished_product'::inventory_product_type
END
WHERE inventory_product_type IS NULL;

UPDATE products
SET inventory_tracking_mode = CASE
  WHEN track_inventory = false THEN 'none'::inventory_tracking_mode
  ELSE 'standard'::inventory_tracking_mode
END
WHERE inventory_tracking_mode IS NULL;

UPDATE products
SET base_unit = COALESCE(unit, 'piece'::measurement_unit)
WHERE base_unit IS NULL;

CREATE TABLE IF NOT EXISTS inventory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'generic',
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_unit measurement_unit NOT NULL,
  to_unit measurement_unit NOT NULL,
  factor NUMERIC(18,6) NOT NULL CHECK (factor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, from_unit, to_unit)
);

INSERT INTO unit_conversions (org_id, from_unit, to_unit, factor)
SELECT o.id, 'kg'::measurement_unit, 'gram'::measurement_unit, 1000
FROM organizations o
ON CONFLICT (org_id, from_unit, to_unit) DO NOTHING;

INSERT INTO unit_conversions (org_id, from_unit, to_unit, factor)
SELECT o.id, 'liter'::measurement_unit, 'ml'::measurement_unit, 1000
FROM organizations o
ON CONFLICT (org_id, from_unit, to_unit) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  source_type batch_source_type NOT NULL,
  source_document_id UUID,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  production_date DATE,
  expiry_date DATE,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity >= 0),
  remaining_quantity NUMERIC(14,4) NOT NULL CHECK (remaining_quantity >= 0),
  unit measurement_unit NOT NULL DEFAULT 'piece',
  is_expired BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id, variant_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_rotation
  ON inventory_batches(warehouse_id, product_id, variant_id, expiry_date, received_date, remaining_quantity);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_supplier
  ON inventory_batches(supplier_id, purchase_invoice_id, received_date);

CREATE TABLE IF NOT EXISTS inventory_batch_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,
  inventory_movement_id UUID REFERENCES inventory_movements(id) ON DELETE SET NULL,
  quantity_delta NUMERIC(14,4) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  imei TEXT,
  warranty_expiry DATE,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, serial_number)
);

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS production_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE transfer_order_lines
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number TEXT;

ALTER TABLE waste_records
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE stock_count_lines
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

INSERT INTO app_settings (org_id, key, value)
SELECT o.id, 'inventory_policy', jsonb_build_object(
  'expiry_alerts_enabled', true,
  'alert_days', jsonb_build_array(7, 14, 30),
  'default_tracking_mode', 'standard',
  'default_rotation_method', 'FIFO',
  'default_expiry_policy', 'block_sale',
  'block_sale_of_expired_items', true,
  'allow_manager_override', true
)
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings a
  WHERE a.org_id = o.id AND a.key = 'inventory_policy'
);

CREATE OR REPLACE FUNCTION calculate_product_expiry_date(
  p_production_date DATE,
  p_shelf_life_days INT,
  p_shelf_life_months INT,
  p_shelf_life_years INT
) RETURNS DATE AS $$
BEGIN
  IF p_production_date IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (p_production_date
    + make_interval(days => COALESCE(p_shelf_life_days, 0))
    + make_interval(months => COALESCE(p_shelf_life_months, 0))
    + make_interval(years => COALESCE(p_shelf_life_years, 0)))::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
