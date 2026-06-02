-- P0 production hardening: multi-org pairing, checkout integrity, stock RLS, storage/anon

-- ---------------------------------------------------------------------------
-- Device pairing: org scope + rate limiting
-- ---------------------------------------------------------------------------
ALTER TABLE device_pairing_codes
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE device_pairing_codes dpc
SET org_id = s.org_id
FROM devices d
JOIN stores s ON s.id = d.store_id
WHERE dpc.device_id = d.id AND dpc.org_id IS NULL;

ALTER TABLE device_pairing_codes
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_org
  ON device_pairing_codes(org_id)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS device_pairing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_pairing_attempts_org_time
  ON device_pairing_attempts(org_id, attempted_at DESC)
  WHERE success = false;

ALTER TABLE device_pairing_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_pairing_attempts_no_direct ON device_pairing_attempts
  FOR ALL USING (false);

DROP POLICY IF EXISTS device_pairing_codes_privileged ON device_pairing_codes;

CREATE POLICY device_pairing_codes_org ON device_pairing_codes FOR ALL
  USING (org_id = auth_org_id() AND is_privileged_role())
  WITH CHECK (org_id = auth_org_id() AND is_privileged_role());

CREATE OR REPLACE FUNCTION record_device_pairing_attempt(p_org_id UUID, p_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO device_pairing_attempts (org_id, success) VALUES (p_org_id, p_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION assert_device_pairing_rate_limit(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_failures INT;
BEGIN
  SELECT COUNT(*) INTO v_failures
  FROM device_pairing_attempts
  WHERE (org_id = p_org_id OR (p_org_id IS NULL AND org_id IS NULL))
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_failures >= 10 THEN
    RAISE EXCEPTION 'Too many pairing attempts. Try again later.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION touch_device_seen(p_device_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM devices d
    WHERE d.id = p_device_id
      AND d.is_active = true
      AND has_store_access(d.store_id)
  ) THEN
    RAISE EXCEPTION 'Device access denied';
  END IF;

  UPDATE devices
  SET last_seen_at = now()
  WHERE id = p_device_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_device_pairing_code(p_device_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_creator UUID;
  v_org_id UUID;
BEGIN
  v_creator := auth_app_user_id();
  IF v_creator IS NULL OR NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT s.org_id INTO v_org_id
  FROM devices d
  JOIN stores s ON s.id = d.store_id
  WHERE d.id = p_device_id AND d.is_active = true AND s.org_id = auth_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  v_code := upper(substring(md5(random()::text || clock_timestamp()::text || p_device_id::text) from 1 for 8));

  INSERT INTO device_pairing_codes (device_id, org_id, code_hash, expires_at, created_by)
  VALUES (
    p_device_id,
    v_org_id,
    extensions.crypt(v_code, extensions.gen_salt('bf')),
    now() + interval '15 minutes',
    v_creator
  );

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION consume_device_pairing_code(p_code TEXT)
RETURNS TABLE(device_id UUID, store_id UUID) AS $$
DECLARE
  rec RECORD;
  v_plain TEXT;
  v_org_id UUID;
BEGIN
  v_plain := upper(trim(p_code));
  IF length(v_plain) < 6 THEN
    RAISE EXCEPTION 'Invalid pairing code';
  END IF;

  v_org_id := auth_org_id();
  PERFORM assert_device_pairing_rate_limit(v_org_id);

  FOR rec IN
    SELECT dpc.id AS code_id, dpc.device_id, d.store_id, dpc.code_hash, dpc.org_id
    FROM device_pairing_codes dpc
    JOIN devices d ON d.id = dpc.device_id
    WHERE dpc.used_at IS NULL
      AND dpc.expires_at > now()
      AND d.is_active = true
      AND (v_org_id IS NULL OR dpc.org_id = v_org_id)
  LOOP
    IF rec.code_hash = extensions.crypt(v_plain, rec.code_hash) THEN
      UPDATE device_pairing_codes
      SET used_at = now()
      WHERE id = rec.code_id AND used_at IS NULL;

      IF NOT FOUND THEN
        PERFORM record_device_pairing_attempt(rec.org_id, false);
        RAISE EXCEPTION 'Pairing code already used';
      END IF;

      PERFORM record_device_pairing_attempt(rec.org_id, true);
      device_id := rec.device_id;
      store_id := rec.store_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  PERFORM record_device_pairing_attempt(v_org_id, false);
  RAISE EXCEPTION 'Invalid or expired pairing code';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION consume_device_pairing_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION consume_device_pairing_code(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Stock / inventory movements: viewer read-only, inventory can mutate
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_store ON stock_levels;
DROP POLICY IF EXISTS movements_store ON inventory_movements;

CREATE POLICY stock_levels_select ON stock_levels FOR SELECT
  USING (has_store_access(store_id));

CREATE POLICY stock_levels_mutate ON stock_levels FOR ALL
  USING (has_store_access(store_id) AND can_mutate_inventory_ops())
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());

CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT
  USING (has_store_access(store_id));

CREATE POLICY inventory_movements_mutate ON inventory_movements FOR ALL
  USING (has_store_access(store_id) AND can_mutate_inventory_ops())
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());

-- ---------------------------------------------------------------------------
-- Storage: anon only reads org public assets folder
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS org_assets_public_select ON storage.objects;

CREATE POLICY org_assets_public_select ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'org-assets'
    AND (storage.foldername(name))[2] = 'public'
  );

-- ---------------------------------------------------------------------------
-- Deployment probe: authenticated only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION deployment_has_organization() FROM anon;
GRANT EXECUTE ON FUNCTION deployment_has_organization() TO authenticated, service_role;

