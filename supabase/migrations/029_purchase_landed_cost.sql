-- Purchase landed cost allocation.

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS extra_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS landed_unit_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS landed_line_total NUMERIC(12,2);

UPDATE purchase_invoice_lines
SET landed_unit_cost = unit_cost,
    landed_line_total = line_total
WHERE landed_unit_cost IS NULL OR landed_line_total IS NULL;
