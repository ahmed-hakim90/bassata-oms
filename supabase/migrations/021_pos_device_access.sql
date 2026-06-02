-- POS device registration, cashier device access, pairing codes

-- pgcrypto functions live in the extensions schema on hosted Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- devices: registration fields
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE devices
SET device_key_hash = extensions.crypt(
  'sf-device-' || id::text || '-' || md5(random()::text || clock_timestamp()::text),
  extensions.gen_salt('bf')
)
WHERE device_key_hash IS NULL;

ALTER TABLE devices
  ALTER COLUMN device_key_hash SET NOT NULL;

ALTER TABLE devices
  DROP COLUMN IF EXISTS last_unlocked_by,
  DROP COLUMN IF EXISTS last_unlocked_at;

-- Pairing codes (one-time, short-lived)
CREATE TABLE device_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_pairing_codes_device ON device_pairing_codes(device_id);
CREATE INDEX idx_device_pairing_codes_expires ON device_pairing_codes(expires_at)
  WHERE used_at IS NULL;

-- Cashier device restrictions (empty = all devices in allowed stores)
CREATE TABLE user_device_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, device_id)
);

CREATE INDEX idx_user_device_access_device ON user_device_access(device_id);

-- Sessions must reference a device
UPDATE cashier_sessions cs
SET device_id = (
  SELECT d.id FROM devices d
  WHERE d.store_id = cs.store_id AND d.is_active = true
  ORDER BY d.name
  LIMIT 1
)
WHERE device_id IS NULL;

ALTER TABLE cashier_sessions
  ALTER COLUMN device_id SET NOT NULL;

-- Enforce device belongs to session store
CREATE OR REPLACE FUNCTION check_session_device_store()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM devices d
    WHERE d.id = NEW.device_id AND d.store_id = NEW.store_id
  ) THEN
    RAISE EXCEPTION 'Device does not belong to session store';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_device_store ON cashier_sessions;
CREATE TRIGGER trg_session_device_store
  BEFORE INSERT OR UPDATE OF device_id, store_id ON cashier_sessions
  FOR EACH ROW EXECUTE FUNCTION check_session_device_store();

-- RLS
ALTER TABLE device_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_device_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_access ON devices;
DROP POLICY IF EXISTS devices_select ON devices;
DROP POLICY IF EXISTS devices_mutate ON devices;

CREATE POLICY devices_select ON devices FOR SELECT
  USING (has_store_access(store_id));

CREATE POLICY devices_mutate ON devices FOR ALL
  USING (has_store_access(store_id) AND is_privileged_role())
  WITH CHECK (has_store_access(store_id) AND is_privileged_role());

CREATE POLICY device_pairing_codes_privileged ON device_pairing_codes FOR ALL
  USING (is_privileged_role())
  WITH CHECK (is_privileged_role());

CREATE POLICY uda_select ON user_device_access FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE org_id = auth_org_id())
  );

CREATE POLICY uda_mutate ON user_device_access FOR ALL
  USING (is_privileged_role())
  WITH CHECK (is_privileged_role());

-- Helpers
CREATE OR REPLACE FUNCTION cashier_can_use_device(
  p_user_id UUID,
  p_store_id UUID,
  p_device_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_device_store UUID;
  v_restricted BOOLEAN;
BEGIN
  SELECT store_id INTO v_device_store
  FROM devices
  WHERE id = p_device_id AND is_active = true;

  IF v_device_store IS NULL OR v_device_store <> p_store_id THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_user_id AND u.role IN ('owner', 'manager') AND u.is_active = true
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM stores s
      JOIN users u ON u.org_id = s.org_id
      WHERE s.id = p_store_id AND u.id = p_user_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_store_access
    WHERE user_id = p_user_id AND store_id = p_store_id
  ) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_device_access uda
    WHERE uda.user_id = p_user_id AND uda.is_active = true
  ) INTO v_restricted;

  IF NOT v_restricted THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_device_access uda
    WHERE uda.user_id = p_user_id
      AND uda.device_id = p_device_id
      AND uda.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION touch_device_seen(p_device_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE devices
  SET last_seen_at = now()
  WHERE id = p_device_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION touch_device_seen TO authenticated;

CREATE OR REPLACE FUNCTION consume_device_pairing_code(p_code TEXT)
RETURNS TABLE(device_id UUID, store_id UUID) AS $$
DECLARE
  rec RECORD;
  v_plain TEXT;
BEGIN
  v_plain := upper(trim(p_code));
  IF length(v_plain) < 6 THEN
    RAISE EXCEPTION 'Invalid pairing code';
  END IF;

  FOR rec IN
    SELECT dpc.id AS code_id, dpc.device_id, d.store_id, dpc.code_hash
    FROM device_pairing_codes dpc
    JOIN devices d ON d.id = dpc.device_id
    WHERE dpc.used_at IS NULL
      AND dpc.expires_at > now()
      AND d.is_active = true
  LOOP
    IF rec.code_hash = extensions.crypt(v_plain, rec.code_hash) THEN
      UPDATE device_pairing_codes
      SET used_at = now()
      WHERE id = rec.code_id AND used_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pairing code already used';
      END IF;

      device_id := rec.device_id;
      store_id := rec.store_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Invalid or expired pairing code';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION consume_device_pairing_code TO authenticated, anon;

-- Replace verify_cashier_pin with device-scoped version
DROP FUNCTION IF EXISTS verify_cashier_pin(UUID, TEXT);

CREATE OR REPLACE FUNCTION verify_cashier_pin(
  p_store_id UUID,
  p_pin TEXT,
  p_device_id UUID
)
RETURNS UUID AS $$
DECLARE
  rec RECORD;
  v_org_id UUID;
  v_attempt_user UUID;
  v_recent_failures INT;
BEGIN
  v_org_id := auth_org_id();
  v_attempt_user := auth_app_user_id();
  IF v_org_id IS NULL OR v_attempt_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
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
  WHERE org_id = v_org_id
    AND store_id = p_store_id
    AND attempted_by = v_attempt_user
    AND success = false
    AND created_at > now() - interval '10 minutes';

  IF v_recent_failures >= 5 THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again later.';
  END IF;

  FOR rec IN
    SELECT u.id, pc.pin_hash
    FROM users u
    JOIN pin_codes pc ON pc.user_id = u.id AND pc.is_active = true
    JOIN user_store_access usa ON usa.user_id = u.id AND usa.store_id = p_store_id
    WHERE u.org_id = v_org_id
      AND u.role = 'cashier'
      AND u.is_active = true
      AND cashier_can_use_device(u.id, p_store_id, p_device_id)
  LOOP
    IF rec.pin_hash = extensions.crypt(p_pin, rec.pin_hash) THEN
      INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
      VALUES (v_org_id, p_store_id, v_attempt_user, true);
      RETURN rec.id;
    END IF;
  END LOOP;

  INSERT INTO pin_attempts (org_id, store_id, attempted_by, success)
  VALUES (v_org_id, p_store_id, v_attempt_user, false);
  RAISE EXCEPTION 'Invalid PIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION verify_cashier_pin(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION create_device_pairing_code(p_device_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_creator UUID;
BEGIN
  v_creator := auth_app_user_id();
  IF v_creator IS NULL OR NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM devices d
    JOIN stores s ON s.id = d.store_id
    WHERE d.id = p_device_id AND d.is_active = true AND s.org_id = auth_org_id()
  ) THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  v_code := upper(substring(md5(random()::text || clock_timestamp()::text || p_device_id::text) from 1 for 8));

  INSERT INTO device_pairing_codes (device_id, code_hash, expires_at, created_by)
  VALUES (
    p_device_id,
    extensions.crypt(v_code, extensions.gen_salt('bf')),
    now() + interval '15 minutes',
    v_creator
  );

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION create_device_pairing_code TO authenticated;
