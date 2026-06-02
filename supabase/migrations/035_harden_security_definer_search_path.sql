-- P0 tenant-security hardening:
-- enforce explicit search_path for critical SECURITY DEFINER functions.

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

ALTER FUNCTION public.complete_checkout_split(
  uuid,
  uuid,
  uuid,
  uuid,
  payment_method,
  numeric,
  jsonb,
  jsonb,
  uuid
) SET search_path = public, extensions;

ALTER FUNCTION public.complete_checkout_expired_override(
  uuid,
  uuid,
  uuid,
  uuid,
  payment_method,
  numeric,
  jsonb,
  uuid
) SET search_path = public, extensions;

ALTER FUNCTION public.complete_checkout_split_expired_override(
  uuid,
  uuid,
  uuid,
  uuid,
  payment_method,
  numeric,
  jsonb,
  jsonb,
  uuid
) SET search_path = public, extensions;

ALTER FUNCTION public.insert_audit_log(
  text,
  text,
  text,
  uuid,
  jsonb
) SET search_path = public, extensions;
