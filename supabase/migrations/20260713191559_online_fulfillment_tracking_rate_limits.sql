-- S14: First-party online fulfillment fields + public menu/order rate limits.
-- Restores fulfillment columns that existed historically for first-party QR orders
-- (without Souqna/marketplace columns — ADR-009).

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_area TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.online_orders
  DROP CONSTRAINT IF EXISTS online_orders_fulfillment_type_check;
ALTER TABLE public.online_orders
  ADD CONSTRAINT online_orders_fulfillment_type_check
  CHECK (
    fulfillment_type IS NULL
    OR fulfillment_type IN ('pickup', 'delivery')
  );

ALTER TABLE public.online_orders
  DROP CONSTRAINT IF EXISTS online_orders_delivery_fee_non_negative;
ALTER TABLE public.online_orders
  ADD CONSTRAINT online_orders_delivery_fee_non_negative
  CHECK (delivery_fee >= 0);

COMMENT ON COLUMN public.online_orders.fulfillment_type IS
  'First-party: pickup | delivery';
COMMENT ON COLUMN public.online_orders.delivery_fee IS
  'Server-calculated fee from store settings zones; never trust client amount';

-- Abuse control for public menu reads + order creates (service_role / SECURITY DEFINER only).
CREATE TABLE IF NOT EXISTS public.online_public_rate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_public_rate_events_action_check
    CHECK (action IN ('menu', 'order_create'))
);

CREATE INDEX IF NOT EXISTS idx_online_public_rate_events_bucket_action_time
  ON public.online_public_rate_events (bucket_key, action, created_at DESC);

ALTER TABLE public.online_public_rate_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS online_public_rate_events_no_direct ON public.online_public_rate_events;
CREATE POLICY online_public_rate_events_no_direct
  ON public.online_public_rate_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.assert_and_record_online_public_rate_limit(
  p_bucket_key TEXT,
  p_action TEXT,
  p_max_events INT DEFAULT 30,
  p_window_seconds INT DEFAULT 60
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_key TEXT := left(trim(coalesce(p_bucket_key, '')), 200);
  v_action TEXT := trim(coalesce(p_action, ''));
  v_max INT := GREATEST(1, LEAST(coalesce(p_max_events, 30), 500));
  v_window INT := GREATEST(5, LEAST(coalesce(p_window_seconds, 60), 3600));
BEGIN
  IF v_key = '' THEN
    RAISE EXCEPTION 'Rate limit bucket required';
  END IF;
  IF v_action NOT IN ('menu', 'order_create') THEN
    RAISE EXCEPTION 'Invalid rate limit action';
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM public.online_public_rate_events
  WHERE bucket_key = v_key
    AND action = v_action
    AND created_at > now() - make_interval(secs => v_window);

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Too many requests. Try again later.';
  END IF;

  INSERT INTO public.online_public_rate_events (bucket_key, action)
  VALUES (v_key, v_action);

  -- Best-effort prune of old rows for this bucket (keeps table small).
  DELETE FROM public.online_public_rate_events
  WHERE bucket_key = v_key
    AND action = v_action
    AND created_at <= now() - make_interval(secs => v_window * 4);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_and_record_online_public_rate_limit(TEXT, TEXT, INT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_and_record_online_public_rate_limit(TEXT, TEXT, INT, INT)
  TO service_role;
