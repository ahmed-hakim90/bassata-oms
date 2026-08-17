-- Expense categories can map to a postable expense GL account.
-- Session till over/short uses a dedicated system account instead of expense_default.
-- CoA opening journals are org-scoped (store_id null).

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS gl_account_id UUID REFERENCES gl_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expense_categories_gl_account_idx
  ON expense_categories (gl_account_id);

CREATE OR REPLACE FUNCTION enforce_expense_category_gl_account_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM gl_accounts a
    WHERE a.id = NEW.gl_account_id
      AND a.org_id = NEW.org_id
      AND a.account_type = 'expense'
      AND a.is_postable = true
      AND a.is_active = true
  ) THEN
    RAISE EXCEPTION 'حساب المصروف غير صالح';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_categories_gl_account_org ON expense_categories;
CREATE TRIGGER expense_categories_gl_account_org
  BEFORE INSERT OR UPDATE OF gl_account_id, org_id
  ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION enforce_expense_category_gl_account_org();

CREATE OR REPLACE FUNCTION ensure_system_gl_accounts(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent UUID;
  v_code TEXT;
BEGIN
  IF auth.role() = 'authenticated' AND p_org_id IS DISTINCT FROM auth_org_id() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM gl_accounts
    WHERE org_id = p_org_id AND system_key = 'cash_over_short'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_parent
  FROM gl_accounts
  WHERE org_id = p_org_id AND code = '5' AND account_type = 'expense'
  LIMIT 1;

  IF v_parent IS NULL THEN
    SELECT id INTO v_parent
    FROM gl_accounts
    WHERE org_id = p_org_id AND account_type = 'expense' AND is_postable = false
    ORDER BY sort_order, code
    LIMIT 1;
  END IF;

  v_code := '5210';
  IF EXISTS (SELECT 1 FROM gl_accounts WHERE org_id = p_org_id AND code = v_code) THEN
    v_code := '5210-OS';
    IF EXISTS (SELECT 1 FROM gl_accounts WHERE org_id = p_org_id AND code = v_code) THEN
      v_code := '5210-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    END IF;
  END IF;

  INSERT INTO gl_accounts (
    org_id, parent_id, code, name, account_type, is_postable, is_system, system_key, sort_order
  ) VALUES (
    p_org_id, v_parent, v_code, 'عجز وزيادة الصندوق', 'expense', true, true, 'cash_over_short', 5210
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_system_gl_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_system_gl_accounts(UUID) TO service_role;

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
    PERFORM ensure_system_gl_accounts(p_org_id);
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
    (p_org_id, v_expenses, '5210', 'عجز وزيادة الصندوق', 'expense', true, true, 'cash_over_short', 5210),
    (p_org_id, v_expenses, '5300', 'هالك وتوالف', 'expense', true, true, 'waste', 5300);
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM organizations LOOP
    PERFORM ensure_system_gl_accounts(r.id);
  END LOOP;
END;
$$;

UPDATE journal_entries
SET store_id = NULL
WHERE source = 'adjustment'
  AND source_id = 'coa_opening';
