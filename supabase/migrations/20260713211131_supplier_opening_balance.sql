-- Prior outstanding balance owed to supplier (org-level AP opening)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE suppliers
  DROP CONSTRAINT IF EXISTS suppliers_opening_balance_nonnegative;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_opening_balance_nonnegative
  CHECK (opening_balance >= 0);

COMMENT ON COLUMN suppliers.opening_balance IS
  'Opening AP balance owed to this supplier before system purchases (EGP). Included in store AP views.';
