-- P0: anon must not execute pairing RPC (021 granted PUBLIC/anon; 025 REVOKE anon only).
REVOKE EXECUTE ON FUNCTION consume_device_pairing_code(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION consume_device_pairing_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION consume_device_pairing_code(TEXT) TO authenticated;
