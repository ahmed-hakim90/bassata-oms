-- App calls checkout RPCs with p_sales_mode; some deployments only had 8-arg signatures.

DROP FUNCTION IF EXISTS public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode
);
CREATE FUNCTION public.complete_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID,
  p_sales_mode sales_mode
) RETURNS JSONB AS $$
BEGIN
  RETURN public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_device_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode
) TO authenticated;

DROP FUNCTION IF EXISTS public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
);
CREATE FUNCTION public.complete_checkout_split(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID,
  p_sales_mode sales_mode
) RETURNS JSONB AS $$
BEGIN
  RETURN public.complete_checkout_split(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_payments,
    p_device_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

DROP FUNCTION IF EXISTS public.complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode
);
CREATE FUNCTION public.complete_checkout_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_device_id UUID,
  p_sales_mode sales_mode
) RETURNS JSONB AS $$
BEGIN
  RETURN public.complete_checkout_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_device_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode
) TO authenticated;

DROP FUNCTION IF EXISTS public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
);
CREATE FUNCTION public.complete_checkout_split_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID,
  p_sales_mode sales_mode
) RETURNS JSONB AS $$
BEGIN
  RETURN public.complete_checkout_split_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    p_payment_method,
    p_discount,
    p_lines,
    p_payments,
    p_device_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;
