-- PIN-as-login for POS: service_role verifies PIN without a prior Auth session.
-- Grant EXECUTE to service_role only — never anon/authenticated.

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
  IF v_action NOT IN ('menu', 'order_create', 'pos_pin_login') THEN
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

CREATE OR REPLACE FUNCTION public.login_cashier_by_pin(
  p_org_id UUID,
  p_store_id UUID,
  p_device_id UUID,
  p_pin TEXT
)
RETURNS TABLE (
  user_id UUID,
  auth_user_id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  v_recent_failures INT;
  v_org_status TEXT;
BEGIN
  IF p_org_id IS NULL OR p_store_id IS NULL OR p_device_id IS NULL THEN
    RAISE EXCEPTION 'Invalid PIN login context';
  END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 OR length(trim(p_pin)) > 8 OR trim(p_pin) !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT o.status INTO v_org_status
  FROM organizations o
  WHERE o.id = p_org_id;

  IF v_org_status IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  IF v_org_status = 'suspended' THEN
    RAISE EXCEPTION 'Organization suspended';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = p_store_id
      AND s.org_id = p_org_id
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM devices d
    WHERE d.id = p_device_id
      AND d.store_id = p_store_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid device for store';
  END IF;

  SELECT COUNT(*) INTO v_recent_failures
  FROM pin_attempts
  WHERE org_id = p_org_id
    AND store_id = p_store_id
    AND success = false
    AND created_at > now() - interval '10 minutes';

  IF v_recent_failures >= 20 THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.';
  END IF;

  FOR rec IN
    SELECT u.id, u.auth_user_id, u.email, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = p_org_id
      AND u.role = 'cashier'
      AND u.is_active = true
      AND u.auth_user_id IS NOT NULL
      AND cashier_can_use_device(u.id, p_store_id, p_device_id)
  LOOP
    IF rec.pin_hash = extensions.crypt(trim(p_pin), rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (p_org_id, p_store_id, rec.id, true);

      user_id := rec.id;
      auth_user_id := rec.auth_user_id;
      email := rec.email;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (p_org_id, p_store_id, NULL, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$$;

REVOKE ALL ON FUNCTION public.login_cashier_by_pin(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_cashier_by_pin(UUID, UUID, UUID, TEXT) TO service_role;
