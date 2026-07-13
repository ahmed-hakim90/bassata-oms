# Refund restock policy (S09 / ADR-007)

Money and stock mutations for refund/void run in Postgres RPC (`refund_order`, `void_order` → `reverse_order_stock_and_credit`). The app must not invent client-side stock math.

## Restock

- Restock **only** what was deducted at sale.
- Source of truth: `inventory_movements` with `reference_type = 'order'`, `movement_type = 'sale'`, `quantity_delta < 0`.
- Restore amount = `abs(quantity_delta)` in stock units.
- Batch-tracked products use existing `trg_apply_order_return_inventory_batch_restore`.
- If inventory was not deducted at sale (no sale movements), restock is a no-op (`restocked = false`).

## Credit (including partial credit split)

- AR reverse uses `SUM(order_payments.amount WHERE method = 'credit')`, **not** `orders.total`.
- Partial credit checkout posts only the credit portion to `customer_ledger` and sets `orders.payment_status = 'partial'`.

## Feature gates

- Refunds require feature flag `refunds` (DB trigger + RPC).
- Permissions: `order_refund` / `order_void` (owners always allowed via `has_permission`).
