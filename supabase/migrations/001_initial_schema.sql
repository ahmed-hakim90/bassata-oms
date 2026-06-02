-- SweetFlow POS — Initial Schema
-- Multi-location retail operations with RLS

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'cashier', 'viewer');
CREATE TYPE order_status AS ENUM ('open', 'completed', 'voided', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'other');
CREATE TYPE session_status AS ENUM ('open', 'closed');
CREATE TYPE movement_type AS ENUM (
  'sale', 'purchase', 'transfer_in', 'transfer_out',
  'waste', 'adjustment', 'stock_count'
);
CREATE TYPE purchase_status AS ENUM ('draft', 'received');
CREATE TYPE transfer_status AS ENUM ('draft', 'sent', 'received');
CREATE TYPE stock_count_status AS ENUM ('in_progress', 'completed');
CREATE TYPE monthly_close_status AS ENUM ('draft', 'closed');
CREATE TYPE import_job_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid', 'partial');

-- Core reference
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_store_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, store_id)
);

CREATE TABLE pin_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_unlocked_by UUID REFERENCES users(id),
  last_unlocked_at TIMESTAMPTZ
);

-- Catalog
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#94A3B8',
  icon TEXT NOT NULL DEFAULT 'package'
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id),
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL DEFAULT '',
  price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Inventory
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL DEFAULT 0,
  reorder_point INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, variant_id)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  movement_type movement_type NOT NULL,
  quantity_delta INT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_store_created ON inventory_movements(store_id, created_at DESC);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_info TEXT NOT NULL DEFAULT ''
);

CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number TEXT NOT NULL,
  status purchase_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

-- Transfers, waste, stock count
CREATE TABLE transfer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_store_id UUID NOT NULL REFERENCES stores(id),
  to_store_id UUID NOT NULL REFERENCES stores(id),
  status transfer_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transfer_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity_sent INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0
);

CREATE TABLE waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL,
  reason_code TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status stock_count_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE stock_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  expected_qty INT NOT NULL,
  counted_qty INT NOT NULL,
  variance INT NOT NULL DEFAULT 0
);

-- POS & orders
CREATE TABLE cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  cashier_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12,2),
  actual_cash NUMERIC(12,2),
  variance NUMERIC(12,2),
  status session_status NOT NULL DEFAULT 'open',
  notes TEXT
);

CREATE INDEX idx_sessions_store_status ON cashier_sessions(store_id, status);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  visit_count INT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id UUID REFERENCES cashier_sessions(id),
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  status order_status NOT NULL DEFAULT 'open',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_store_created ON orders(store_id, created_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  modifiers JSONB NOT NULL DEFAULT '[]',
  line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method payment_method NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id UUID REFERENCES cashier_sessions(id),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  receipt_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty
CREATE TABLE loyalty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  points_per_currency NUMERIC(8,4) NOT NULL DEFAULT 1,
  redemption_rate NUMERIC(8,4) NOT NULL DEFAULT 0.01,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  points_delta INT NOT NULL,
  balance_after INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reporting & system
CREATE TABLE monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status monthly_close_status NOT NULL DEFAULT 'draft',
  summary JSONB NOT NULL DEFAULT '{}',
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ
);

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status import_job_status NOT NULL DEFAULT 'pending',
  file_url TEXT,
  result JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_created ON audit_logs(org_id, created_at DESC);

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  UNIQUE (org_id, key)
);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org from auth
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT org_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Owner/manager org-wide access policies (baseline)
CREATE POLICY org_read ON organizations FOR SELECT
  USING (id = auth_org_id());

CREATE POLICY stores_org ON stores FOR ALL
  USING (org_id = auth_org_id());

CREATE POLICY users_org ON users FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY products_org ON products FOR ALL
  USING (org_id = auth_org_id());

CREATE POLICY customers_org ON customers FOR ALL
  USING (org_id = auth_org_id());

CREATE POLICY audit_org ON audit_logs FOR SELECT
  USING (org_id = auth_org_id());

-- Store-scoped inventory and orders via user_store_access
CREATE POLICY stock_store ON stock_levels FOR ALL
  USING (
    store_id IN (
      SELECT store_id FROM user_store_access
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY orders_store ON orders FOR ALL
  USING (
    store_id IN (
      SELECT store_id FROM user_store_access
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );
