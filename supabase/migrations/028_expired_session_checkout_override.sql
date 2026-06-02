-- Manager/owner override for expired-session checkout.
--
-- complete_checkout performs the canonical inventory, recipe, credit, and audit
-- work, but it intentionally blocks expired sessions. This wrapper validates a
-- privileged operator, locks the session row, temporarily normalizes opened_at
-- inside the same transaction, calls complete_checkout, then restores opened_at.

CREATE OR REPLACE FUNCTION complete_checkout_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID DEFAULT NULL
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
    p_device_id
  );

  UPDATE cashier_sessions SET opened_at = v_opened_at WHERE id = p_session_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION complete_checkout_split_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL
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
    p_device_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID
) TO authenticated;
