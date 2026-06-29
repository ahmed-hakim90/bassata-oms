-- Allow checkout to continue when stock is unavailable.
-- The sale is recorded and stock_levels are allowed to go negative so the
-- shortage remains visible in inventory reports.

UPDATE app_settings
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{prevent_negative_stock}', 'false'::jsonb, true)
WHERE key = 'feature_flags';

DO $$
DECLARE
  v_signature REGPROCEDURE :=
    'public.complete_checkout(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode)'::REGPROCEDURE;
  v_function_def TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_function_def;

  v_function_def := replace(
    v_function_def,
    'COALESCE((v_flags->>''prevent_negative_stock'')::boolean, true)',
    'COALESCE((v_flags->>''prevent_negative_stock'')::boolean, false)'
  );

  v_old := $old$
        UPDATE stock_levels SET quantity = quantity - v_deduct_qty, updated_at = now()
        WHERE warehouse_id = v_warehouse_id AND product_id = v_ingredient.ing_id AND variant_id IS NULL;
$old$;
  v_new := $new$
        INSERT INTO stock_levels (
          store_id, warehouse_id, product_id, variant_id, quantity, reorder_point, updated_at
        ) VALUES (
          p_store_id, v_warehouse_id, v_ingredient.ing_id, NULL, -v_deduct_qty, 10, now()
        )
        ON CONFLICT (
          warehouse_id,
          product_id,
          (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
        )
        DO UPDATE SET quantity = stock_levels.quantity - v_deduct_qty, updated_at = now();
$new$;
  IF position(v_old IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'Could not patch ingredient stock deduction';
  END IF;
  v_function_def := replace(v_function_def, v_old, v_new);

  v_old := $old$
      UPDATE stock_levels SET quantity = quantity - v_base_qty, updated_at = now()
      WHERE warehouse_id = v_warehouse_id AND product_id = v_product_id
        AND (variant_id IS NOT DISTINCT FROM v_variant_id);
$old$;
  v_new := $new$
      INSERT INTO stock_levels (
        store_id, warehouse_id, product_id, variant_id, quantity, reorder_point, updated_at
      ) VALUES (
        p_store_id, v_warehouse_id, v_product_id, v_variant_id, -v_base_qty, 10, now()
      )
      ON CONFLICT (
        warehouse_id,
        product_id,
        (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
      )
      DO UPDATE SET quantity = stock_levels.quantity - v_base_qty, updated_at = now();
$new$;
  IF position(v_old IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'Could not patch product stock deduction';
  END IF;
  v_function_def := replace(v_function_def, v_old, v_new);

  EXECUTE v_function_def;
END $$;

ALTER FUNCTION public.complete_checkout(
  uuid,
  uuid,
  uuid,
  uuid,
  payment_method,
  numeric,
  jsonb,
  uuid,
  sales_mode
) SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.apply_sale_inventory_batch_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_needed NUMERIC(14,4);
  v_take NUMERIC(14,4);
  v_available NUMERIC(14,4);
  v_original_needed NUMERIC(14,4);
  v_batch RECORD;
  v_flags JSONB := '{}'::jsonb;
  v_prevent_negative_stock BOOLEAN := false;
BEGIN
  IF NEW.movement_type <> 'sale'
    OR NEW.quantity_delta >= 0
    OR NEW.batch_id IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT
    p.org_id,
    p.inventory_tracking_mode,
    p.inventory_rotation_method,
    p.expiry_policy
  INTO v_product
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF NOT FOUND
    OR v_product.inventory_tracking_mode NOT IN ('batch', 'batch_and_expiry')
  THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_flags
  FROM public.app_settings
  WHERE org_id = v_product.org_id AND key = 'feature_flags'
  LIMIT 1;
  v_prevent_negative_stock := COALESCE((COALESCE(v_flags, '{}'::jsonb)->>'prevent_negative_stock')::boolean, false);

  IF v_prevent_negative_stock
    AND v_product.inventory_tracking_mode = 'batch_and_expiry'
    AND v_product.expiry_policy = 'block_sale'
    AND EXISTS (
      SELECT 1
      FROM public.inventory_batches b
      WHERE b.warehouse_id = NEW.warehouse_id
        AND b.product_id = NEW.product_id
        AND b.variant_id IS NOT DISTINCT FROM NEW.variant_id
        AND b.remaining_quantity > 0
        AND b.expiry_date IS NOT NULL
        AND b.expiry_date < CURRENT_DATE
    )
  THEN
    RAISE EXCEPTION 'Expired batch stock exists for product %', NEW.product_id;
  END IF;

  v_needed := abs(NEW.quantity_delta);
  v_original_needed := v_needed;

  SELECT COALESCE(sum(b.remaining_quantity), 0)
  INTO v_available
  FROM public.inventory_batches b
  WHERE b.warehouse_id = NEW.warehouse_id
    AND b.product_id = NEW.product_id
    AND b.variant_id IS NOT DISTINCT FROM NEW.variant_id
    AND b.remaining_quantity > 0
    AND (
      v_product.inventory_tracking_mode <> 'batch_and_expiry'
      OR b.expiry_date IS NULL
      OR b.expiry_date >= CURRENT_DATE
    );

  IF v_prevent_negative_stock AND v_available + 0.0001 < v_needed THEN
    RAISE EXCEPTION 'Insufficient batch stock for product %', NEW.product_id;
  END IF;

  FOR v_batch IN
    SELECT b.*
    FROM public.inventory_batches b
    WHERE b.warehouse_id = NEW.warehouse_id
      AND b.product_id = NEW.product_id
      AND b.variant_id IS NOT DISTINCT FROM NEW.variant_id
      AND b.remaining_quantity > 0
      AND (
        v_product.inventory_tracking_mode <> 'batch_and_expiry'
        OR b.expiry_date IS NULL
        OR b.expiry_date >= CURRENT_DATE
      )
    ORDER BY
      CASE
        WHEN v_product.inventory_rotation_method = 'FEFO'
        THEN b.expiry_date
        ELSE NULL
      END ASC NULLS LAST,
      b.received_date ASC,
      b.created_at ASC,
      b.id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_needed <= 0;

    v_take := least(v_batch.remaining_quantity, v_needed);

    UPDATE public.inventory_batches
    SET
      remaining_quantity = remaining_quantity - v_take,
      updated_at = now(),
      is_expired = COALESCE(expiry_date < CURRENT_DATE, false)
    WHERE id = v_batch.id;

    INSERT INTO public.inventory_batch_movements (
      org_id,
      batch_id,
      inventory_movement_id,
      quantity_delta,
      reference_type,
      reference_id
    ) VALUES (
      v_product.org_id,
      v_batch.id,
      NEW.id,
      -v_take,
      NEW.reference_type,
      NEW.reference_id
    );

    IF v_take = v_original_needed THEN
      UPDATE public.inventory_movements
      SET
        batch_id = v_batch.id,
        batch_number = v_batch.batch_number,
        expiry_date = v_batch.expiry_date
      WHERE id = NEW.id;
    END IF;

    v_needed := v_needed - v_take;
  END LOOP;

  IF v_prevent_negative_stock AND v_needed > 0.0001 THEN
    RAISE EXCEPTION 'Insufficient batch stock for product %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
