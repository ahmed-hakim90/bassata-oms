ALTER TABLE cashier_sessions
  DROP CONSTRAINT IF EXISTS cashier_sessions_device_id_fkey,
  ADD CONSTRAINT cashier_sessions_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL;
