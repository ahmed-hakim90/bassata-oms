-- Wipe operational data, keep users + products (+ store/org structure).
-- Safe to run on production demo resets. Requires service-role / SQL access.

BEGIN;

TRUNCATE TABLE
  order_item_deductions,
  order_payments,
  order_items,
  orders,
  online_order_items,
  online_orders,
  inventory_batch_movements,
  inventory_batches,
  inventory_movements,
  stock_levels,
  stock_count_lines,
  stock_counts,
  cashier_sessions,
  customer_ledger,
  customer_payments,
  customers,
  expenses,
  purchase_invoice_lines,
  purchase_invoices,
  supplier_payments,
  transfer_order_lines,
  transfer_orders,
  waste_records,
  audit_logs,
  pin_attempts,
  device_pairing_codes,
  device_pairing_attempts,
  import_jobs,
  loyalty_ledger,
  product_serial_numbers
RESTART IDENTITY CASCADE;

COMMIT;
