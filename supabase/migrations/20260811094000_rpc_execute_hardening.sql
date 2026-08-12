-- Supabase projects may have ALTER DEFAULT PRIVILEGES that explicitly grant
-- function execution to anon/authenticated. Revoke every inherited grant first,
-- then allow only the intended caller roles.

REVOKE ALL ON FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_checkout(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_checkout_core(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_checkout_split_core(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_checkout_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_unpaid_checkout(
  UUID, UUID, UUID, UUID, NUMERIC, JSONB
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.create_online_order_atomic(JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_online_order_atomic(JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.update_online_order_details_atomic(UUID, JSONB, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_online_order_details_atomic(UUID, JSONB, JSONB)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_online_order_reservation(UUID, BOOLEAN, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_online_order_reservation(UUID, BOOLEAN, UUID)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.invoice_online_order_checkout(
  UUID, UUID, UUID, UUID, payment_method, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_online_order_checkout(
  UUID, UUID, UUID, UUID, payment_method, JSONB, UUID
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_online_order_status_atomic(
  UUID, online_order_status, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_online_order_status_atomic(
  UUID, online_order_status, UUID
) TO authenticated, service_role;
