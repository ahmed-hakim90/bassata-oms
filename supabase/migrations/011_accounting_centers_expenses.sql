-- Accounting centers, structured expenses, and RBAC

-- Enums
CREATE TYPE cost_center_type AS ENUM (
  'operations', 'cleaning', 'utilities', 'packaging', 'maintenance',
  'salaries', 'marketing', 'other'
);

CREATE TYPE expense_payment_method AS ENUM ('cash', 'card', 'wallet', 'other');
CREATE TYPE expense_source AS ENUM ('session_cash', 'external', 'purchase');
CREATE TYPE expense_status AS ENUM ('pending', 'approved');

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'purchase_from_session';

-- RBAC
CREATE TABLE permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE role_permissions (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (org_id, role, permission_key)
);

CREATE TABLE user_permission_grants (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX idx_role_permissions_org ON role_permissions(org_id);
CREATE INDEX idx_user_permission_grants_user ON user_permission_grants(user_id);

-- Cost centers
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type cost_center_type NOT NULL DEFAULT 'other',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE INDEX idx_cost_centers_org_active ON cost_centers(org_id, is_active);

-- Expense categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_inventory_item BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, cost_center_id, name)
);

CREATE INDEX idx_expense_categories_center ON expense_categories(cost_center_id);

-- Seed permissions
INSERT INTO permissions (key, label, description, group_name) VALUES
  ('expense_create', 'Create expenses', 'Create general expenses', 'expenses'),
  ('expense_edit', 'Edit expenses', 'Edit existing expenses', 'expenses'),
  ('expense_delete', 'Delete expenses', 'Delete expenses', 'expenses'),
  ('expense_view_all', 'View all expenses', 'View expense reports and ledger', 'expenses'),
  ('expense_approve', 'Approve expenses', 'Approve pending expenses', 'expenses'),
  ('cost_center_manage', 'Manage cost centers', 'Create and edit cost centers', 'accounting'),
  ('expense_category_manage', 'Manage expense categories', 'Create and edit expense categories', 'accounting'),
  ('session_expense_create', 'Session expenses', 'Record expenses during cashier session', 'expenses'),
  ('purchase_from_session_create', 'Session inventory purchase', 'Buy inventory items during session', 'expenses');

-- RBAC helpers
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_permission(p_key TEXT) RETURNS BOOLEAN AS $$
DECLARE
  v_role user_role;
  v_user_id UUID;
  v_org_id UUID;
  v_grant BOOLEAN;
BEGIN
  SELECT role, id, org_id INTO v_role, v_user_id, v_org_id
  FROM users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RETURN true; END IF;

  SELECT granted INTO v_grant
  FROM user_permission_grants
  WHERE user_id = v_user_id AND permission_key = p_key;

  IF FOUND THEN RETURN v_grant; END IF;

  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE org_id = v_org_id AND role = v_role AND permission_key = p_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Alter expenses: add new columns (nullable during migration)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES expense_categories(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES products(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,3);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method expense_payment_method;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_source expense_source;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status expense_status;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Seed default cost centers and categories per org, migrate existing expenses
DO $$
DECLARE
  r_org RECORD;
  cc_util UUID;
  cc_clean UUID;
  cc_pack UUID;
  cc_maint UUID;
  cc_sal UUID;
  cc_misc UUID;
  cat_other UUID;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    INSERT INTO cost_centers (org_id, name, code, type) VALUES
      (r_org.id, 'Utilities', 'UTIL', 'utilities'),
      (r_org.id, 'Cleaning', 'CLEAN', 'cleaning'),
      (r_org.id, 'Packaging', 'PACK', 'packaging'),
      (r_org.id, 'Maintenance', 'MAINT', 'maintenance'),
      (r_org.id, 'Salaries', 'SAL', 'salaries'),
      (r_org.id, 'Store Supplies', 'SUP', 'operations'),
      (r_org.id, 'Delivery', 'DEL', 'operations'),
      (r_org.id, 'Miscellaneous', 'MISC', 'other')
    ON CONFLICT (org_id, code) DO NOTHING;

    SELECT id INTO cc_util FROM cost_centers WHERE org_id = r_org.id AND code = 'UTIL';
    SELECT id INTO cc_clean FROM cost_centers WHERE org_id = r_org.id AND code = 'CLEAN';
    SELECT id INTO cc_pack FROM cost_centers WHERE org_id = r_org.id AND code = 'PACK';
    SELECT id INTO cc_maint FROM cost_centers WHERE org_id = r_org.id AND code = 'MAINT';
    SELECT id INTO cc_sal FROM cost_centers WHERE org_id = r_org.id AND code = 'SAL';
    SELECT id INTO cc_misc FROM cost_centers WHERE org_id = r_org.id AND code = 'MISC';

    INSERT INTO expense_categories (org_id, cost_center_id, name, requires_inventory_item) VALUES
      (r_org.id, cc_util, 'Electricity', false),
      (r_org.id, cc_util, 'Water', false),
      (r_org.id, cc_util, 'Internet', false),
      (r_org.id, cc_clean, 'Cleaning tools', false),
      (r_org.id, cc_clean, 'Detergents', false),
      (r_org.id, cc_clean, 'Trash bags', false),
      (r_org.id, cc_clean, 'Cleaning Service', false),
      (r_org.id, cc_pack, 'Cups', true),
      (r_org.id, cc_pack, 'Spoons', true),
      (r_org.id, cc_pack, 'Napkins', true),
      (r_org.id, cc_maint, 'Repairs', false),
      (r_org.id, cc_sal, 'Payroll', false),
      (r_org.id, cc_misc, 'Other', false),
      (r_org.id, cc_misc, 'Petty cash', false),
      (r_org.id, cc_misc, 'Supplies', false)
    ON CONFLICT (org_id, cost_center_id, name) DO NOTHING;

    SELECT ec.id INTO cat_other
    FROM expense_categories ec
    JOIN cost_centers cc ON cc.id = ec.cost_center_id
    WHERE ec.org_id = r_org.id AND cc.code = 'MISC' AND ec.name = 'Other'
    LIMIT 1;

    UPDATE expenses e
    SET
      cost_center_id = COALESCE(
        CASE e.category
          WHEN 'Utilities' THEN cc_util
          WHEN 'Supplies' THEN (SELECT id FROM cost_centers WHERE org_id = r_org.id AND code = 'SUP' LIMIT 1)
          WHEN 'Petty cash' THEN cc_misc
          ELSE cc_misc
        END,
        cc_misc
      ),
      expense_category_id = COALESCE(
        (SELECT ec.id FROM expense_categories ec
         JOIN cost_centers cc ON cc.id = ec.cost_center_id
         WHERE ec.org_id = r_org.id AND ec.name = e.category LIMIT 1),
        cat_other
      ),
      title = COALESCE(e.description, e.category, 'Expense'),
      payment_method = 'cash',
      expense_source = CASE WHEN e.session_id IS NOT NULL THEN 'session_cash'::expense_source ELSE 'external'::expense_source END,
      status = 'approved',
      notes = ''
    FROM stores s
    WHERE e.store_id = s.id AND s.org_id = r_org.id
      AND e.cost_center_id IS NULL;

    -- Seed role permissions for this org
    INSERT INTO role_permissions (org_id, role, permission_key)
    SELECT r_org.id, 'owner', key FROM permissions
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'manager', 'expense_create'),
      (r_org.id, 'manager', 'expense_edit'),
      (r_org.id, 'manager', 'expense_delete'),
      (r_org.id, 'manager', 'expense_view_all'),
      (r_org.id, 'manager', 'expense_approve'),
      (r_org.id, 'manager', 'expense_category_manage'),
      (r_org.id, 'manager', 'session_expense_create'),
      (r_org.id, 'manager', 'purchase_from_session_create'),
      (r_org.id, 'cashier', 'session_expense_create'),
      (r_org.id, 'cashier', 'purchase_from_session_create'),
      (r_org.id, 'viewer', 'expense_view_all')
    ON CONFLICT DO NOTHING;

    -- expense_settings app_setting
    INSERT INTO app_settings (org_id, key, value)
    VALUES (
      r_org.id,
      'expense_settings',
      jsonb_build_object(
        'approval_required', false,
        'cashier_can_add_session_expense', true,
        'cashier_max_expense_amount', null,
        'allow_inventory_purchase_from_session', true,
        'default_cost_center_packaging', cc_pack::text,
        'default_cost_center_cleaning', cc_clean::text,
        'default_cost_center_utilities', cc_util::text,
        'prevent_expenses_in_closed_periods', true
      )
    )
    ON CONFLICT (org_id, key) DO NOTHING;
  END LOOP;
END $$;

-- Finalize expenses columns
UPDATE expenses SET title = 'Expense' WHERE title IS NULL OR title = '';
UPDATE expenses SET notes = '' WHERE notes IS NULL;
UPDATE expenses SET status = 'approved' WHERE status IS NULL;
UPDATE expenses SET payment_method = 'cash' WHERE payment_method IS NULL;
UPDATE expenses SET expense_source = 'external' WHERE expense_source IS NULL;

ALTER TABLE expenses ALTER COLUMN cost_center_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN expense_category_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN title SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN title SET DEFAULT '';
ALTER TABLE expenses ALTER COLUMN payment_method SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN expense_source SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN status SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE expenses ALTER COLUMN notes SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN notes SET DEFAULT '';

ALTER TABLE expenses DROP COLUMN IF EXISTS category;
ALTER TABLE expenses DROP COLUMN IF EXISTS description;

CREATE INDEX idx_expenses_store_created ON expenses(store_id, created_at DESC);
CREATE INDEX idx_expenses_cost_center ON expenses(cost_center_id);
CREATE INDEX idx_expenses_category ON expenses(expense_category_id);
CREATE INDEX idx_expenses_session ON expenses(session_id) WHERE session_id IS NOT NULL;

-- Updated expense mutation helpers
CREATE OR REPLACE FUNCTION can_mutate_expenses() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR has_permission('expense_create')
    OR has_permission('session_expense_create');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_edit_expenses() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR has_permission('expense_edit');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_delete_expenses() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR has_permission('expense_delete');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: cost_centers
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_centers_select ON cost_centers FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY cost_centers_insert ON cost_centers FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND has_permission('cost_center_manage'));
CREATE POLICY cost_centers_update ON cost_centers FOR UPDATE
  USING (org_id = auth_org_id() AND has_permission('cost_center_manage'))
  WITH CHECK (org_id = auth_org_id() AND has_permission('cost_center_manage'));
CREATE POLICY cost_centers_delete ON cost_centers FOR DELETE
  USING (org_id = auth_org_id() AND has_permission('cost_center_manage'));

-- RLS: expense_categories
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_categories_select ON expense_categories FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY expense_categories_insert ON expense_categories FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND has_permission('expense_category_manage'));
CREATE POLICY expense_categories_update ON expense_categories FOR UPDATE
  USING (org_id = auth_org_id() AND has_permission('expense_category_manage'))
  WITH CHECK (org_id = auth_org_id() AND has_permission('expense_category_manage'));
CREATE POLICY expense_categories_delete ON expense_categories FOR DELETE
  USING (org_id = auth_org_id() AND has_permission('expense_category_manage'));

-- RLS: permissions (read-only for authenticated)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select ON permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY role_permissions_mutate ON role_permissions FOR ALL
  USING (org_id = auth_org_id() AND auth_user_role() = 'owner')
  WITH CHECK (org_id = auth_org_id() AND auth_user_role() = 'owner');

ALTER TABLE user_permission_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_grants_select ON user_permission_grants FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
  );
CREATE POLICY user_grants_mutate ON user_permission_grants FOR ALL
  USING (auth_user_role() = 'owner')
  WITH CHECK (auth_user_role() = 'owner');

-- Update expenses RLS
DROP POLICY IF EXISTS expenses_update ON expenses;
DROP POLICY IF EXISTS expenses_delete ON expenses;

CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (has_store_access(store_id) AND can_edit_expenses())
  WITH CHECK (has_store_access(store_id) AND can_edit_expenses());

CREATE POLICY expenses_delete ON expenses FOR DELETE
  USING (has_store_access(store_id) AND can_delete_expenses());

GRANT EXECUTE ON FUNCTION has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_expenses TO authenticated;
GRANT EXECUTE ON FUNCTION can_delete_expenses TO authenticated;
