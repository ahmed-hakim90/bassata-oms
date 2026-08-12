-- Keep the mature checkout implementation private and expose a narrow, guarded
-- entrypoint.  UI checks are intentionally duplicated here because authenticated
-- clients can call RPC functions directly.

ALTER FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) RENAME TO complete_checkout_core;

REVOKE ALL ON FUNCTION public.complete_checkout_core(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, authenticated;

CREATE FUNCTION public.complete_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail',
  p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_role user_role;
  v_settings JSONB := '{}'::jsonb;
  v_threshold NUMERIC;
  v_threshold_text TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_caller := auth_app_user_id();
  IF v_org_id IS NULL OR v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role
  INTO v_role
  FROM users
  WHERE id = v_caller
    AND org_id = v_org_id
    AND is_active = true;

  IF v_role IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;

  -- A normal cashier may only post under their own identity. Owner/manager PIN
  -- switching remains supported, but is enforced at the trust boundary.
  IF p_cashier_id IS DISTINCT FROM v_caller
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;

  IF COALESCE(p_discount, 0) < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  SELECT COALESCE(value, '{}'::jsonb)
  INTO v_settings
  FROM app_settings
  WHERE org_id = v_org_id
    AND key = 'session_settings'
  LIMIT 1;

  v_threshold_text := v_settings->>'manager_discount_override_amount';
  IF v_threshold_text IS NOT NULL
     AND v_threshold_text ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_threshold := v_threshold_text::numeric;
  END IF;

  IF v_threshold IS NOT NULL
     AND COALESCE(p_discount, 0) > v_threshold
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Manager discount override required';
  END IF;

  RETURN public.complete_checkout_core(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    COALESCE(p_discount, 0),
    p_lines,
    p_device_id,
    p_sales_mode,
    p_coupon_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) IS 'Guarded checkout entrypoint. Enforces checkout permission, cashier identity, and manager discount threshold.';

-- Split checkout is a separate authenticated RPC. Guard it independently before
-- its legacy implementation performs any writes.
ALTER FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) RENAME TO complete_checkout_split_core;

REVOKE ALL ON FUNCTION public.complete_checkout_split_core(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, authenticated;

CREATE FUNCTION public.complete_checkout_split(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail',
  p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_role user_role;
  v_settings JSONB := '{}'::jsonb;
  v_threshold NUMERIC;
  v_threshold_text TEXT;
BEGIN
  v_org_id := auth_org_id();
  v_caller := auth_app_user_id();
  IF v_org_id IS NULL OR v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT role INTO v_role
  FROM users
  WHERE id = v_caller AND org_id = v_org_id AND is_active = true;
  IF v_role IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF p_cashier_id IS DISTINCT FROM v_caller AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Cashier mismatch';
  END IF;
  IF COALESCE(p_discount, 0) < 0 THEN RAISE EXCEPTION 'Discount cannot be negative'; END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_settings
  FROM app_settings
  WHERE org_id = v_org_id AND key = 'session_settings'
  LIMIT 1;
  v_threshold_text := v_settings->>'manager_discount_override_amount';
  IF v_threshold_text IS NOT NULL AND v_threshold_text ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_threshold := v_threshold_text::numeric;
  END IF;
  IF v_threshold IS NOT NULL AND COALESCE(p_discount, 0) > v_threshold
     AND v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Manager discount override required';
  END IF;

  RETURN public.complete_checkout_split_core(
    p_store_id, p_session_id, p_cashier_id, p_customer_id, p_payment_method,
    COALESCE(p_discount, 0), p_lines, p_payments, p_device_id, p_sales_mode,
    p_coupon_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) TO authenticated;
