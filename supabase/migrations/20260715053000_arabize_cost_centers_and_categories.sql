-- Arabize default cost centers / expense categories for existing orgs and new seeds.

-- Existing English seed names → Arabic (idempotent by exact English match)
UPDATE cost_centers SET name = 'المرافق' WHERE name = 'Utilities';
UPDATE cost_centers SET name = 'النظافة' WHERE name = 'Cleaning';
UPDATE cost_centers SET name = 'التعبئة والتغليف' WHERE name = 'Packaging';
UPDATE cost_centers SET name = 'الصيانة' WHERE name = 'Maintenance';
UPDATE cost_centers SET name = 'الرواتب' WHERE name = 'Salaries';
UPDATE cost_centers SET name = 'مستلزمات الفرع' WHERE name = 'Store Supplies';
UPDATE cost_centers SET name = 'التوصيل' WHERE name = 'Delivery';
UPDATE cost_centers SET name = 'متنوع' WHERE name = 'Miscellaneous';

UPDATE expense_categories SET name = 'كهرباء' WHERE name = 'Electricity';
UPDATE expense_categories SET name = 'مياه' WHERE name = 'Water';
UPDATE expense_categories SET name = 'إنترنت' WHERE name = 'Internet';
UPDATE expense_categories SET name = 'أدوات نظافة' WHERE name = 'Cleaning tools';
UPDATE expense_categories SET name = 'منظفات' WHERE name = 'Detergents';
UPDATE expense_categories SET name = 'أكياس قمامة' WHERE name = 'Trash bags';
UPDATE expense_categories SET name = 'خدمة نظافة' WHERE name = 'Cleaning Service';
UPDATE expense_categories SET name = 'أكواب' WHERE name = 'Cups';
UPDATE expense_categories SET name = 'ملاعق' WHERE name = 'Spoons';
UPDATE expense_categories SET name = 'مناديل' WHERE name = 'Napkins';
UPDATE expense_categories SET name = 'إصلاحات' WHERE name = 'Repairs';
UPDATE expense_categories SET name = 'مرتبات' WHERE name = 'Payroll';
UPDATE expense_categories SET name = 'أخرى' WHERE name = 'Other';
UPDATE expense_categories SET name = 'نثرية' WHERE name = 'Petty cash';
UPDATE expense_categories SET name = 'مستلزمات' WHERE name = 'Supplies';

-- Keep seed_org_defaults aligned for any callers still using it
CREATE OR REPLACE FUNCTION seed_org_defaults(p_org_id UUID, p_store_id UUID)
RETURNS VOID AS $$
DECLARE
  cc_util UUID;
  cc_clean UUID;
  cc_pack UUID;
  cc_maint UUID;
  cc_sal UUID;
  cc_misc UUID;
BEGIN
  INSERT INTO cost_centers (org_id, name, code, type) VALUES
    (p_org_id, 'المرافق', 'UTIL', 'utilities'),
    (p_org_id, 'النظافة', 'CLEAN', 'cleaning'),
    (p_org_id, 'التعبئة والتغليف', 'PACK', 'packaging'),
    (p_org_id, 'الصيانة', 'MAINT', 'maintenance'),
    (p_org_id, 'الرواتب', 'SAL', 'salaries'),
    (p_org_id, 'مستلزمات الفرع', 'SUP', 'operations'),
    (p_org_id, 'التوصيل', 'DEL', 'operations'),
    (p_org_id, 'متنوع', 'MISC', 'other')
  ON CONFLICT (org_id, code) DO NOTHING;

  SELECT id INTO cc_util FROM cost_centers WHERE org_id = p_org_id AND code = 'UTIL';
  SELECT id INTO cc_clean FROM cost_centers WHERE org_id = p_org_id AND code = 'CLEAN';
  SELECT id INTO cc_pack FROM cost_centers WHERE org_id = p_org_id AND code = 'PACK';
  SELECT id INTO cc_maint FROM cost_centers WHERE org_id = p_org_id AND code = 'MAINT';
  SELECT id INTO cc_sal FROM cost_centers WHERE org_id = p_org_id AND code = 'SAL';
  SELECT id INTO cc_misc FROM cost_centers WHERE org_id = p_org_id AND code = 'MISC';

  INSERT INTO expense_categories (org_id, cost_center_id, name, requires_inventory_item) VALUES
    (p_org_id, cc_util, 'كهرباء', false),
    (p_org_id, cc_util, 'مياه', false),
    (p_org_id, cc_util, 'إنترنت', false),
    (p_org_id, cc_clean, 'أدوات نظافة', false),
    (p_org_id, cc_clean, 'منظفات', false),
    (p_org_id, cc_clean, 'أكياس قمامة', false),
    (p_org_id, cc_clean, 'خدمة نظافة', false),
    (p_org_id, cc_pack, 'أكواب', true),
    (p_org_id, cc_pack, 'ملاعق', true),
    (p_org_id, cc_pack, 'مناديل', true),
    (p_org_id, cc_maint, 'إصلاحات', false),
    (p_org_id, cc_sal, 'مرتبات', false),
    (p_org_id, cc_misc, 'أخرى', false),
    (p_org_id, cc_misc, 'نثرية', false),
    (p_org_id, cc_misc, 'مستلزمات', false)
  ON CONFLICT (org_id, cost_center_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Patch initialize_organization seed strings without rewriting the full RPC body
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'initialize_organization'
  LIMIT 1;

  IF def IS NULL THEN
    RAISE EXCEPTION 'initialize_organization not found';
  END IF;

  -- Longer category phrases before shorter center names they contain (e.g. Cleaning tools).
  def := replace(def, '''Cleaning tools''', '''أدوات نظافة''');
  def := replace(def, '''Cleaning Service''', '''خدمة نظافة''');
  def := replace(def, '''Trash bags''', '''أكياس قمامة''');
  def := replace(def, '''Petty cash''', '''نثرية''');
  def := replace(def, '''Store Supplies''', '''مستلزمات الفرع''');
  def := replace(def, '''Electricity''', '''كهرباء''');
  def := replace(def, '''Internet''', '''إنترنت''');
  def := replace(def, '''Detergents''', '''منظفات''');
  def := replace(def, '''Repairs''', '''إصلاحات''');
  def := replace(def, '''Payroll''', '''مرتبات''');
  def := replace(def, '''Napkins''', '''مناديل''');
  def := replace(def, '''Supplies''', '''مستلزمات''');
  def := replace(def, '''Spoons''', '''ملاعق''');
  def := replace(def, '''Water''', '''مياه''');
  def := replace(def, '''Cups''', '''أكواب''');
  def := replace(def, '''Other''', '''أخرى''');

  def := replace(def, '''Utilities''', '''المرافق''');
  def := replace(def, '''Cleaning''', '''النظافة''');
  def := replace(def, '''Packaging''', '''التعبئة والتغليف''');
  def := replace(def, '''Maintenance''', '''الصيانة''');
  def := replace(def, '''Salaries''', '''الرواتب''');
  def := replace(def, '''Delivery''', '''التوصيل''');
  def := replace(def, '''Miscellaneous''', '''متنوع''');

  EXECUTE def;
END $$;
