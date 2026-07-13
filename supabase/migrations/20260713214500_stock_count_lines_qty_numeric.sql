-- Allow fractional stock for weight/volume items (align with stock_levels.quantity).
ALTER TABLE stock_count_lines
  ALTER COLUMN expected_qty TYPE numeric USING expected_qty::numeric,
  ALTER COLUMN counted_qty TYPE numeric USING counted_qty::numeric,
  ALTER COLUMN variance TYPE numeric USING variance::numeric;
