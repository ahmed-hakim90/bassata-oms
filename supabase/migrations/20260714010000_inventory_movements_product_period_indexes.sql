-- Speed up product stock card / period ledger queries
CREATE INDEX IF NOT EXISTS inventory_movements_product_warehouse_created_idx
  ON public.inventory_movements (product_id, warehouse_id, created_at);

CREATE INDEX IF NOT EXISTS inventory_movements_store_product_created_idx
  ON public.inventory_movements (store_id, product_id, created_at);
