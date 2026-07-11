-- Allow partial credit in split checkout (cash/card + credit on same order).
-- Seed cashier permission for collecting customer debt without a new sale.

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
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

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

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  -- When mixing credit with other tenders, complete the sale as non-credit first,
  -- then post only the credit portion to the customer ledger.
  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

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

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;

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
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

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

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

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

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

-- Allow cashiers to collect customer debt (without a new sale).
INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, 'cashier', 'customer_payment_receive'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM role_permissions rp
  WHERE rp.org_id = o.id
    AND rp.role = 'cashier'
    AND rp.permission_key = 'customer_payment_receive'
);
