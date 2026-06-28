-- Make checkout safer under concurrency and keep batch stock in sync with sales.

CREATE TABLE IF NOT EXISTS public.order_number_counters (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  last_number INT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, business_date)
);

ALTER TABLE public.order_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_number_counters_no_direct_access ON public.order_number_counters;
CREATE POLICY order_number_counters_no_direct_access
  ON public.order_number_counters
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.next_order_number(
  p_store_id UUID,
  p_created_at TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT AS $$
DECLARE
  v_business_date DATE := (p_created_at AT TIME ZONE 'UTC')::DATE;
  v_sequence INT;
BEGIN
  INSERT INTO public.order_number_counters (store_id, business_date, last_number)
  VALUES (p_store_id, v_business_date, 1)
  ON CONFLICT (store_id, business_date)
  DO UPDATE SET
    last_number = public.order_number_counters.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_sequence;

  RETURN 'SF-' ||
    to_char(p_created_at AT TIME ZONE 'UTC', 'YYYYMMDD') ||
    '-' ||
    lpad(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.apply_sale_inventory_batch_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_needed NUMERIC(14,4);
  v_take NUMERIC(14,4);
  v_available NUMERIC(14,4);
  v_original_needed NUMERIC(14,4);
  v_batch RECORD;
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

  IF v_product.inventory_tracking_mode = 'batch_and_expiry'
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

  IF v_available + 0.0001 < v_needed THEN
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

  IF v_needed > 0.0001 THEN
    RAISE EXCEPTION 'Insufficient batch stock for product %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS trg_apply_sale_inventory_batch_deduction
  ON public.inventory_movements;

CREATE TRIGGER trg_apply_sale_inventory_batch_deduction
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_sale_inventory_batch_deduction();

CREATE OR REPLACE FUNCTION public.apply_order_return_inventory_batch_restore()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_needed NUMERIC(14,4);
  v_restore NUMERIC(14,4);
  v_already_restored NUMERIC(14,4);
  v_remaining_from_sale NUMERIC(14,4);
  v_sale_batch RECORD;
  v_single_batch_id UUID := NULL;
  v_single_batch_number TEXT := NULL;
  v_single_expiry_date DATE := NULL;
  v_batch_count INT := 0;
BEGIN
  IF NEW.movement_type <> 'adjustment'
    OR NEW.quantity_delta <= 0
    OR NEW.reference_type NOT IN ('order_refund', 'order_void')
    OR NEW.reference_id IS NULL
    OR NEW.batch_id IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT
    p.org_id,
    p.inventory_tracking_mode
  INTO v_product
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF NOT FOUND
    OR v_product.inventory_tracking_mode NOT IN ('batch', 'batch_and_expiry')
  THEN
    RETURN NEW;
  END IF;

  v_needed := NEW.quantity_delta;

  FOR v_sale_batch IN
    SELECT
      ibm.batch_id,
      b.batch_number,
      b.expiry_date,
      abs(sum(ibm.quantity_delta)) AS sold_quantity
    FROM public.inventory_movements im
    JOIN public.inventory_batch_movements ibm
      ON ibm.inventory_movement_id = im.id
    JOIN public.inventory_batches b
      ON b.id = ibm.batch_id
    WHERE im.reference_type = 'order'
      AND im.reference_id = NEW.reference_id
      AND im.product_id = NEW.product_id
      AND im.variant_id IS NOT DISTINCT FROM NEW.variant_id
      AND im.movement_type = 'sale'
      AND ibm.quantity_delta < 0
    GROUP BY ibm.batch_id, b.batch_number, b.expiry_date, b.received_date, b.created_at, b.id
    ORDER BY b.received_date ASC, b.created_at ASC, b.id ASC
  LOOP
    EXIT WHEN v_needed <= 0;

    SELECT COALESCE(sum(rbm.quantity_delta), 0)
    INTO v_already_restored
    FROM public.inventory_movements rim
    JOIN public.inventory_batch_movements rbm
      ON rbm.inventory_movement_id = rim.id
    WHERE rim.reference_type IN ('order_refund', 'order_void')
      AND rim.reference_id = NEW.reference_id
      AND rim.product_id = NEW.product_id
      AND rim.variant_id IS NOT DISTINCT FROM NEW.variant_id
      AND rbm.batch_id = v_sale_batch.batch_id
      AND rbm.quantity_delta > 0;

    v_remaining_from_sale := v_sale_batch.sold_quantity - v_already_restored;
    IF v_remaining_from_sale <= 0 THEN
      CONTINUE;
    END IF;

    v_restore := least(v_remaining_from_sale, v_needed);

    UPDATE public.inventory_batches
    SET
      remaining_quantity = remaining_quantity + v_restore,
      updated_at = now(),
      is_expired = COALESCE(expiry_date < CURRENT_DATE, false)
    WHERE id = v_sale_batch.batch_id;

    INSERT INTO public.inventory_batch_movements (
      org_id,
      batch_id,
      inventory_movement_id,
      quantity_delta,
      reference_type,
      reference_id
    ) VALUES (
      v_product.org_id,
      v_sale_batch.batch_id,
      NEW.id,
      v_restore,
      NEW.reference_type,
      NEW.reference_id
    );

    v_batch_count := v_batch_count + 1;
    v_single_batch_id := v_sale_batch.batch_id;
    v_single_batch_number := v_sale_batch.batch_number;
    v_single_expiry_date := v_sale_batch.expiry_date;
    v_needed := v_needed - v_restore;
  END LOOP;

  IF NEW.quantity_delta > 0 AND v_needed > 0.0001 THEN
    RAISE EXCEPTION 'Could not restore batch stock for returned order movement %', NEW.id;
  END IF;

  IF v_batch_count = 1 THEN
    UPDATE public.inventory_movements
    SET
      batch_id = v_single_batch_id,
      batch_number = v_single_batch_number,
      expiry_date = v_single_expiry_date
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

DROP TRIGGER IF EXISTS trg_apply_order_return_inventory_batch_restore
  ON public.inventory_movements;

CREATE TRIGGER trg_apply_order_return_inventory_batch_restore
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_order_return_inventory_batch_restore();

DO $$
DECLARE
  v_signature REGPROCEDURE :=
    'public.complete_checkout(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode)'::REGPROCEDURE;
  v_function_def TEXT;
  v_old TEXT := $old$
  v_today := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count FROM orders
  WHERE store_id = p_store_id AND created_at::date = now()::date;
  v_order_number := 'SF-' || v_today || '-' || lpad(v_count::text, 4, '0');
$old$;
  v_new TEXT := $new$
  v_order_number := public.next_order_number(p_store_id, now());
$new$;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_function_def;

  IF position(v_old IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'Could not patch complete_checkout order number generation';
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
