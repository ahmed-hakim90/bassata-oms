-- Preserve POS sales mode through split/expired checkout wrappers and prevent
-- inventory records from pairing a store with a warehouse owned by another store.

DROP FUNCTION IF EXISTS public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID
);

CREATE OR REPLACE FUNCTION public.complete_checkout_split(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_flags JSONB := '{}'::jsonb;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_credit_count INT := 0;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := COALESCE((v_payment->>'amount')::numeric, 0);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 0 AND jsonb_array_length(p_payments) > 1 THEN
    RAISE EXCEPTION 'Credit cannot be mixed with split payments';
  END IF;

  v_result := complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := (v_result->>'total')::numeric;

  IF abs(v_payment_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Split payments must equal order total';
  END IF;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_checkout_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB AS $$
DECLARE
  v_caller UUID;
  v_role user_role;
  v_opened_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT role INTO v_role FROM users WHERE id = v_caller AND is_active = true;
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Owner or manager override required';
  END IF;

  SELECT opened_at INTO v_opened_at
  FROM cashier_sessions
  WHERE id = p_session_id
    AND store_id = p_store_id
    AND status = 'open'
  FOR UPDATE;

  IF v_opened_at IS NULL THEN
    RAISE EXCEPTION 'Invalid or closed cashier session';
  END IF;

  UPDATE cashier_sessions SET opened_at = now() WHERE id = p_session_id;

  v_result := complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  UPDATE cashier_sessions SET opened_at = v_opened_at WHERE id = p_session_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode
) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_checkout_split_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_flags JSONB := '{}'::jsonb;
  v_org_id UUID;
  v_credit_count INT := 0;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := COALESCE((v_payment->>'amount')::numeric, 0);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 0 AND jsonb_array_length(p_payments) > 1 THEN
    RAISE EXCEPTION 'Credit cannot be mixed with split payments';
  END IF;

  v_result := complete_checkout_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := (v_result->>'total')::numeric;

  IF abs(v_payment_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Split payments must equal order total';
  END IF;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_warehouse_store_match()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_store_id UUID;
  v_warehouse_org_id UUID;
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

  IF TG_TABLE_NAME = 'inventory_batches'
    AND NEW.org_id IS DISTINCT FROM v_warehouse_org_id
  THEN
    RAISE EXCEPTION 'Warehouse % does not belong to org % on %',
      NEW.warehouse_id, NEW.org_id, TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_warehouse_store_match() FROM authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.purchase_invoices pi
    LEFT JOIN public.warehouses w
      ON w.id = pi.warehouse_id
     AND w.store_id = pi.store_id
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing purchase_invoices rows have warehouse/store mismatches';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_levels sl
    LEFT JOIN public.warehouses w
      ON w.id = sl.warehouse_id
     AND w.store_id = sl.store_id
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing stock_levels rows have warehouse/store mismatches';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_movements im
    LEFT JOIN public.warehouses w
      ON w.id = im.warehouse_id
     AND w.store_id = im.store_id
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing inventory_movements rows have warehouse/store mismatches';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_batches ib
    LEFT JOIN public.warehouses w
      ON w.id = ib.warehouse_id
     AND w.store_id = ib.store_id
     AND w.org_id = ib.org_id
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing inventory_batches rows have warehouse/store/org mismatches';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_purchase_invoices_warehouse_store_match ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoices_warehouse_store_match
  BEFORE INSERT OR UPDATE OF store_id, warehouse_id ON public.purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_store_match();

DROP TRIGGER IF EXISTS trg_stock_levels_warehouse_store_match ON public.stock_levels;
CREATE TRIGGER trg_stock_levels_warehouse_store_match
  BEFORE INSERT OR UPDATE OF store_id, warehouse_id ON public.stock_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_store_match();

DROP TRIGGER IF EXISTS trg_inventory_movements_warehouse_store_match ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_warehouse_store_match
  BEFORE INSERT OR UPDATE OF store_id, warehouse_id ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_store_match();

DROP TRIGGER IF EXISTS trg_inventory_batches_warehouse_store_match ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batches_warehouse_store_match
  BEFORE INSERT OR UPDATE OF store_id, warehouse_id ON public.inventory_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_warehouse_store_match();

CREATE OR REPLACE FUNCTION public.validate_transfer_warehouse_store_match()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stores fs
    JOIN public.stores ts ON ts.id = NEW.to_store_id
    WHERE fs.id = NEW.from_store_id
      AND fs.org_id IS DISTINCT FROM ts.org_id
  ) THEN
    RAISE EXCEPTION 'Transfer stores must belong to the same org';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses w
    WHERE w.id = NEW.from_warehouse_id
      AND w.store_id = NEW.from_store_id
  ) THEN
    RAISE EXCEPTION 'Source warehouse % does not belong to source store %',
      NEW.from_warehouse_id, NEW.from_store_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses w
    WHERE w.id = NEW.to_warehouse_id
      AND w.store_id = NEW.to_store_id
  ) THEN
    RAISE EXCEPTION 'Destination warehouse % does not belong to destination store %',
      NEW.to_warehouse_id, NEW.to_store_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.validate_transfer_warehouse_store_match() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_transfer_warehouse_store_match() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_transfer_warehouse_store_match() FROM authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transfer_orders t
    JOIN public.stores fs ON fs.id = t.from_store_id
    JOIN public.stores ts ON ts.id = t.to_store_id
    LEFT JOIN public.warehouses fw
      ON fw.id = t.from_warehouse_id
     AND fw.store_id = t.from_store_id
    LEFT JOIN public.warehouses tw
      ON tw.id = t.to_warehouse_id
     AND tw.store_id = t.to_store_id
    WHERE fw.id IS NULL
       OR tw.id IS NULL
       OR fs.org_id IS DISTINCT FROM ts.org_id
  ) THEN
    RAISE EXCEPTION 'Existing transfer_orders rows have warehouse/store/org mismatches';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_transfer_orders_warehouse_store_match ON public.transfer_orders;
CREATE TRIGGER trg_transfer_orders_warehouse_store_match
  BEFORE INSERT OR UPDATE OF from_store_id, to_store_id, from_warehouse_id, to_warehouse_id
  ON public.transfer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transfer_warehouse_store_match();
