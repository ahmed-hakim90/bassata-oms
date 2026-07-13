-- Fix validate_warehouse_store_match: tables without org_id (stock_levels, etc.)
-- were failing with `record "new" has no field "org_id"` because plpgsql still
-- resolves NEW.org_id even behind TG_TABLE_NAME = 'inventory_batches'.

CREATE OR REPLACE FUNCTION public.validate_warehouse_store_match()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_store_id UUID;
  v_warehouse_org_id UUID;
  v_row_org_id UUID;
BEGIN
  IF NEW.warehouse_id IS NULL OR NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT w.store_id, w.org_id
    INTO v_warehouse_store_id, v_warehouse_org_id
  FROM public.warehouses w
  WHERE w.id = NEW.warehouse_id;

  IF v_warehouse_store_id IS DISTINCT FROM NEW.store_id THEN
    RAISE EXCEPTION 'Warehouse % does not belong to store % on %',
      NEW.warehouse_id, NEW.store_id, TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'inventory_batches' THEN
    v_row_org_id := (to_jsonb(NEW)->>'org_id')::uuid;
    IF v_row_org_id IS DISTINCT FROM v_warehouse_org_id THEN
      RAISE EXCEPTION 'Warehouse % does not belong to org % on %',
        NEW.warehouse_id, v_row_org_id, TG_TABLE_NAME;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM authenticated;
