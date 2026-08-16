-- Line discount on purchase documents (invoice / PO / request / return).
-- unit_cost stays the entered unit price; line_total = qty * unit_cost - discount_amount.
-- Receive/landed cost already uses line_total, so inventory gets the net cost.

ALTER TABLE public.purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_invoice_lines
  DROP CONSTRAINT IF EXISTS purchase_invoice_lines_discount_amount_nonnegative;

ALTER TABLE public.purchase_invoice_lines
  ADD CONSTRAINT purchase_invoice_lines_discount_amount_nonnegative
  CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.purchase_invoice_lines.discount_amount IS
  'Money discount on the line; line_total = quantity * unit_cost - discount_amount';
