-- Fix split checkout: reconcile payment rows to the server-calculated order total
-- (single-payment checkout already ignores client amounts and stores v_total).
-- Also collapse overloaded signatures so PostgREST can resolve the RPC reliably.

DROP FUNCTION IF EXISTS public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
);
DROP FUNCTION IF EXISTS public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
);
DROP FUNCTION IF EXISTS public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID
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
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
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

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    RAISE EXCEPTION 'Credit cannot be mixed with split payments';
  END IF;

  v_result := public.complete_checkout(
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
  v_total := round((v_result->>'total')::numeric, 2);

  -- Keep earlier split amounts; adjust the last row so payments always equal the order total
  -- (mirrors single-payment checkout which stores server total, not the client amount).
  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
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
$$;

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
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
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

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    RAISE EXCEPTION 'Credit cannot be mixed with split payments';
  END IF;

  v_result := public.complete_checkout_expired_override(
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
  v_total := round((v_result->>'total')::numeric, 2);

  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
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
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;
