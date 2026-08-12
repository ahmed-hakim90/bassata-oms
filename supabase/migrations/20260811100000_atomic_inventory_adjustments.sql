-- Keep stock, batch balances, movement history, and audit logging in one transaction.
-- Also make NULL variants participate in the inventory-batch uniqueness rule.

CREATE TEMP TABLE inventory_batch_duplicates ON COMMIT DROP AS
SELECT
  min(id::text)::uuid AS keep_id,
  warehouse_id,
  product_id,
  variant_id,
  batch_number,
  sum(quantity) AS total_quantity,
  sum(remaining_quantity) AS total_remaining_quantity
FROM public.inventory_batches
GROUP BY warehouse_id, product_id, variant_id, batch_number
HAVING count(*) > 1;

UPDATE public.inventory_batches b
SET
  quantity = d.total_quantity,
  remaining_quantity = d.total_remaining_quantity,
  updated_at = now()
FROM inventory_batch_duplicates d
WHERE b.id = d.keep_id;

-- Preserve every document and movement reference before removing duplicate rows.
UPDATE public.inventory_batch_movements child
SET batch_id = d.keep_id
FROM public.inventory_batches duplicate
JOIN inventory_batch_duplicates d
  ON duplicate.warehouse_id = d.warehouse_id
 AND duplicate.product_id = d.product_id
 AND duplicate.variant_id IS NOT DISTINCT FROM d.variant_id
 AND duplicate.batch_number = d.batch_number
WHERE child.batch_id = duplicate.id
  AND duplicate.id <> d.keep_id;

UPDATE public.inventory_movements child
SET batch_id = d.keep_id
FROM public.inventory_batches duplicate
JOIN inventory_batch_duplicates d
  ON duplicate.warehouse_id = d.warehouse_id
 AND duplicate.product_id = d.product_id
 AND duplicate.variant_id IS NOT DISTINCT FROM d.variant_id
 AND duplicate.batch_number = d.batch_number
WHERE child.batch_id = duplicate.id
  AND duplicate.id <> d.keep_id;

UPDATE public.stock_count_lines child
SET batch_id = d.keep_id
FROM public.inventory_batches duplicate
JOIN inventory_batch_duplicates d
  ON duplicate.warehouse_id = d.warehouse_id
 AND duplicate.product_id = d.product_id
 AND duplicate.variant_id IS NOT DISTINCT FROM d.variant_id
 AND duplicate.batch_number = d.batch_number
WHERE child.batch_id = duplicate.id
  AND duplicate.id <> d.keep_id;

UPDATE public.transfer_order_lines child
SET batch_id = d.keep_id
FROM public.inventory_batches duplicate
JOIN inventory_batch_duplicates d
  ON duplicate.warehouse_id = d.warehouse_id
 AND duplicate.product_id = d.product_id
 AND duplicate.variant_id IS NOT DISTINCT FROM d.variant_id
 AND duplicate.batch_number = d.batch_number
WHERE child.batch_id = duplicate.id
  AND duplicate.id <> d.keep_id;

UPDATE public.waste_records child
SET batch_id = d.keep_id
FROM public.inventory_batches duplicate
JOIN inventory_batch_duplicates d
  ON duplicate.warehouse_id = d.warehouse_id
 AND duplicate.product_id = d.product_id
 AND duplicate.variant_id IS NOT DISTINCT FROM d.variant_id
 AND duplicate.batch_number = d.batch_number
WHERE child.batch_id = duplicate.id
  AND duplicate.id <> d.keep_id;

DELETE FROM public.inventory_batches b
USING inventory_batch_duplicates d
WHERE b.warehouse_id = d.warehouse_id
  AND b.product_id = d.product_id
  AND b.variant_id IS NOT DISTINCT FROM d.variant_id
  AND b.batch_number = d.batch_number
  AND b.id <> d.keep_id;

ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS inventory_batches_warehouse_id_product_id_variant_id_batch__key;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_batches_warehouse_product_variant_batch_key
  ON public.inventory_batches (
    warehouse_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    batch_number
  );

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_store_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity_delta numeric,
  p_movement_type public.movement_type,
  p_reference_type text,
  p_reference_id uuid,
  p_reason text,
  p_created_by uuid,
  p_prevent_negative boolean DEFAULT false,
  p_batch_number text DEFAULT NULL,
  p_batch_production_date date DEFAULT NULL,
  p_batch_expiry_date date DEFAULT NULL,
  p_batch_received_date date DEFAULT NULL,
  p_batch_supplier_id uuid DEFAULT NULL,
  p_batch_purchase_invoice_id uuid DEFAULT NULL,
  p_batch_source_type public.batch_source_type DEFAULT 'adjustment',
  p_batch_source_document_id uuid DEFAULT NULL,
  p_batch_unit public.measurement_unit DEFAULT 'piece',
  p_created_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_current_quantity numeric;
  v_batch_id uuid;
  v_batch_number text;
  v_batch_remaining numeric;
  v_movement public.inventory_movements%ROWTYPE;
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Inventory quantity delta cannot be zero';
  END IF;

  SELECT s.org_id
  INTO v_org_id
  FROM public.stores s
  JOIN public.warehouses w
    ON w.id = p_warehouse_id
   AND w.store_id = s.id
   AND w.is_active
  WHERE s.id = p_store_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse does not belong to the selected store';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Product does not belong to the selected organization';
  END IF;

  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = p_variant_id
      AND pv.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Variant does not belong to the selected product';
  END IF;

  IF auth.role() = 'authenticated' AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_created_by
      AND u.auth_user_id = auth.uid()
      AND u.org_id = v_org_id
      AND u.is_active
  ) THEN
    RAISE EXCEPTION 'Authenticated user does not match inventory actor';
  END IF;

  -- Serialize updates to the same SKU even when its stock row does not exist yet.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_warehouse_id::text || ':' || p_product_id::text || ':' || COALESCE(p_variant_id::text, ''),
      0
    )
  );

  SELECT sl.quantity
  INTO v_current_quantity
  FROM public.stock_levels sl
  WHERE sl.warehouse_id = p_warehouse_id
    AND sl.product_id = p_product_id
    AND sl.variant_id IS NOT DISTINCT FROM p_variant_id
  FOR UPDATE;

  v_current_quantity := COALESCE(v_current_quantity, 0);
  IF p_prevent_negative AND v_current_quantity + p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  INSERT INTO public.stock_levels (
    store_id,
    warehouse_id,
    product_id,
    variant_id,
    quantity,
    reorder_point
  )
  VALUES (
    p_store_id,
    p_warehouse_id,
    p_product_id,
    p_variant_id,
    p_quantity_delta,
    10
  )
  ON CONFLICT (
    warehouse_id,
    product_id,
    (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  DO UPDATE SET
    quantity = public.stock_levels.quantity + EXCLUDED.quantity,
    updated_at = now();

  v_batch_number := NULLIF(btrim(p_batch_number), '');
  IF v_batch_number IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'batch:' || p_warehouse_id::text || ':' || p_product_id::text || ':' ||
          COALESCE(p_variant_id::text, '') || ':' || v_batch_number,
        0
      )
    );

    SELECT b.id, b.remaining_quantity
    INTO v_batch_id, v_batch_remaining
    FROM public.inventory_batches b
    WHERE b.warehouse_id = p_warehouse_id
      AND b.product_id = p_product_id
      AND b.variant_id IS NOT DISTINCT FROM p_variant_id
      AND b.batch_number = v_batch_number
    FOR UPDATE;

    IF v_batch_id IS NULL THEN
      IF p_quantity_delta < 0 THEN
        RAISE EXCEPTION 'Batch % is required for outbound inventory', v_batch_number;
      END IF;

      INSERT INTO public.inventory_batches (
        org_id,
        store_id,
        warehouse_id,
        product_id,
        variant_id,
        batch_number,
        source_type,
        source_document_id,
        supplier_id,
        purchase_invoice_id,
        received_date,
        production_date,
        expiry_date,
        quantity,
        remaining_quantity,
        unit,
        created_by,
        is_expired
      )
      VALUES (
        v_org_id,
        p_store_id,
        p_warehouse_id,
        p_product_id,
        p_variant_id,
        v_batch_number,
        p_batch_source_type,
        p_batch_source_document_id,
        p_batch_supplier_id,
        p_batch_purchase_invoice_id,
        COALESCE(p_batch_received_date, CURRENT_DATE),
        p_batch_production_date,
        p_batch_expiry_date,
        p_quantity_delta,
        p_quantity_delta,
        p_batch_unit,
        p_created_by,
        p_batch_expiry_date IS NOT NULL AND p_batch_expiry_date < CURRENT_DATE
      )
      RETURNING id INTO v_batch_id;
    ELSE
      IF v_batch_remaining + p_quantity_delta < 0 THEN
        RAISE EXCEPTION 'Insufficient batch stock';
      END IF;

      UPDATE public.inventory_batches
      SET
        remaining_quantity = remaining_quantity + p_quantity_delta,
        expiry_date = COALESCE(p_batch_expiry_date, expiry_date),
        production_date = COALESCE(p_batch_production_date, production_date),
        supplier_id = COALESCE(p_batch_supplier_id, supplier_id),
        purchase_invoice_id = COALESCE(p_batch_purchase_invoice_id, purchase_invoice_id),
        updated_at = now(),
        is_expired = COALESCE(p_batch_expiry_date, expiry_date) IS NOT NULL
          AND COALESCE(p_batch_expiry_date, expiry_date) < CURRENT_DATE
      WHERE id = v_batch_id;
    END IF;
  END IF;

  INSERT INTO public.inventory_movements (
    store_id,
    warehouse_id,
    product_id,
    variant_id,
    movement_type,
    quantity_delta,
    reference_type,
    reference_id,
    reason,
    batch_id,
    batch_number,
    expiry_date,
    created_by,
    created_at
  )
  VALUES (
    p_store_id,
    p_warehouse_id,
    p_product_id,
    p_variant_id,
    p_movement_type,
    p_quantity_delta,
    p_reference_type,
    p_reference_id,
    p_reason,
    v_batch_id,
    v_batch_number,
    p_batch_expiry_date,
    p_created_by,
    COALESCE(p_created_at, now())
  )
  RETURNING * INTO v_movement;

  PERFORM public.insert_audit_log(
    'stock.adjusted',
    'stock_level',
    p_warehouse_id::text || ':' || p_product_id::text,
    p_store_id,
    jsonb_build_object(
      'warehouseId', p_warehouse_id,
      'quantityDelta', p_quantity_delta,
      'movementType', p_movement_type,
      'batchNumber', v_batch_number
    )
  );

  RETURN to_jsonb(v_movement);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_inventory_stock(
  uuid, uuid, uuid, uuid, numeric, public.movement_type, text, uuid, text, uuid,
  boolean, text, date, date, date, uuid, uuid, public.batch_source_type, uuid,
  public.measurement_unit, timestamptz
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(
  uuid, uuid, uuid, uuid, numeric, public.movement_type, text, uuid, text, uuid,
  boolean, text, date, date, date, uuid, uuid, public.batch_source_type, uuid,
  public.measurement_unit, timestamptz
) TO authenticated;
