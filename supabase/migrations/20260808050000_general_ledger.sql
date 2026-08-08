-- General ledger: chart of accounts tree + double-entry journals + default Arabic CoA.

CREATE TYPE gl_account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

CREATE TYPE journal_entry_status AS ENUM ('draft', 'posted', 'void');

CREATE TYPE journal_source AS ENUM (
  'manual',
  'sale',
  'expense',
  'purchase',
  'customer_payment',
  'supplier_payment',
  'refund',
  'adjustment'
);

CREATE TABLE gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES gl_accounts(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type gl_account_type NOT NULL,
  is_postable BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gl_accounts_code_unique UNIQUE (org_id, code),
  CONSTRAINT gl_accounts_parent_not_self CHECK (parent_id IS DISTINCT FROM id)
);

CREATE UNIQUE INDEX gl_accounts_org_system_key_uidx
  ON gl_accounts (org_id, system_key)
  WHERE system_key IS NOT NULL;

CREATE INDEX gl_accounts_org_parent_idx ON gl_accounts (org_id, parent_id);
CREATE INDEX gl_accounts_org_type_idx ON gl_accounts (org_id, account_type);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  status journal_entry_status NOT NULL DEFAULT 'draft',
  source journal_source NOT NULL DEFAULT 'manual',
  source_id TEXT,
  memo TEXT NOT NULL DEFAULT '',
  posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_number_unique UNIQUE (org_id, entry_number)
);

CREATE UNIQUE INDEX journal_entries_posted_source_uidx
  ON journal_entries (org_id, source, source_id)
  WHERE source_id IS NOT NULL AND status = 'posted';

CREATE INDEX journal_entries_org_date_idx ON journal_entries (org_id, entry_date DESC);
CREATE INDEX journal_entries_org_status_idx ON journal_entries (org_id, status);
CREATE INDEX journal_entries_store_date_idx ON journal_entries (store_id, entry_date DESC);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo TEXT NOT NULL DEFAULT '',
  line_no INT NOT NULL DEFAULT 1,
  CONSTRAINT journal_lines_one_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX journal_lines_entry_idx ON journal_lines (entry_id, line_no);
CREATE INDEX journal_lines_account_idx ON journal_lines (account_id);

ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY gl_accounts_org ON gl_accounts FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY journal_entries_org ON journal_entries FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY journal_lines_org ON journal_lines FOR ALL
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

INSERT INTO permissions (key, label, description, group_name) VALUES
  ('gl_view', 'View general ledger', 'View chart of accounts, journals, and trial balance', 'accounting'),
  ('gl_manage', 'Manage general ledger', 'Edit accounts and create/post/void journals', 'accounting')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, r.role::user_role, p.key
FROM organizations o
CROSS JOIN (VALUES ('owner'), ('manager')) AS r(role)
CROSS JOIN (VALUES ('gl_view'), ('gl_manage')) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.org_id = o.id AND rp.role = r.role::user_role AND rp.permission_key = p.key
);

-- Seed default Arabic chart of accounts for an org (idempotent).
CREATE OR REPLACE FUNCTION seed_default_chart_of_accounts(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assets UUID;
  v_current_assets UUID;
  v_liabilities UUID;
  v_current_liab UUID;
  v_equity UUID;
  v_revenue UUID;
  v_expenses UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM gl_accounts WHERE org_id = p_org_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, NULL, '1', 'الأصول', 'asset', false, true, NULL, 100)
  RETURNING id INTO v_assets;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, v_assets, '11', 'أصول متداولة', 'asset', false, true, NULL, 110)
  RETURNING id INTO v_current_assets;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES
    (p_org_id, v_current_assets, '1111', 'الصندوق / النقدية', 'asset', true, true, 'cash', 1111),
    (p_org_id, v_current_assets, '1112', 'البنك / بطاقات', 'asset', true, true, 'card', 1112),
    (p_org_id, v_current_assets, '1113', 'المحفظة الإلكترونية', 'asset', true, true, 'wallet', 1113),
    (p_org_id, v_current_assets, '1119', 'طرق دفع أخرى', 'asset', true, true, 'other_payment', 1119),
    (p_org_id, v_current_assets, '1120', 'العملاء (مدينون)', 'asset', true, true, 'ar', 1120),
    (p_org_id, v_current_assets, '1130', 'المخزون', 'asset', true, true, 'inventory', 1130);

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, NULL, '2', 'الخصوم', 'liability', false, true, NULL, 200)
  RETURNING id INTO v_liabilities;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, v_liabilities, '21', 'خصوم متداولة', 'liability', false, true, NULL, 210)
  RETURNING id INTO v_current_liab;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES
    (p_org_id, v_current_liab, '2110', 'الموردون (دائنون)', 'liability', true, true, 'ap', 2110),
    (p_org_id, v_current_liab, '2120', 'ضريبة مستحقة', 'liability', true, true, 'tax_payable', 2120);

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, NULL, '3', 'حقوق الملكية', 'equity', false, true, NULL, 300)
  RETURNING id INTO v_equity;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES
    (p_org_id, v_equity, '3100', 'رأس المال', 'equity', true, true, 'equity_capital', 3100),
    (p_org_id, v_equity, '3200', 'أرباح مرحلة', 'equity', true, true, 'retained_earnings', 3200);

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, NULL, '4', 'الإيرادات', 'revenue', false, true, NULL, 400)
  RETURNING id INTO v_revenue;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES
    (p_org_id, v_revenue, '4100', 'إيرادات المبيعات', 'revenue', true, true, 'sales_revenue', 4100),
    (p_org_id, v_revenue, '4200', 'خصم مسموح به', 'revenue', true, true, 'sales_discount', 4200);

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES (p_org_id, NULL, '5', 'التكاليف والمصروفات', 'expense', false, true, NULL, 500)
  RETURNING id INTO v_expenses;

  INSERT INTO gl_accounts (org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order)
  VALUES
    (p_org_id, v_expenses, '5100', 'تكلفة البضاعة المباعة', 'expense', true, true, 'cogs', 5100),
    (p_org_id, v_expenses, '5200', 'مصروفات تشغيل', 'expense', true, true, 'expense_default', 5200),
    (p_org_id, v_expenses, '5300', 'هالك وتوالف', 'expense', true, true, 'waste', 5300);
END;
$$;

GRANT EXECUTE ON FUNCTION seed_default_chart_of_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_default_chart_of_accounts(UUID) TO service_role;

-- Seed for all existing orgs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM organizations LOOP
    PERFORM seed_default_chart_of_accounts(r.id);
  END LOOP;
END;
$$;

-- Enable feature flag key when missing
UPDATE app_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{general_ledger}', 'true'::jsonb, true)
WHERE key = 'feature_flags'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'general_ledger');
