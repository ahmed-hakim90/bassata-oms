-- Souqna marketplace integration: product channel, online order extensions, logs, rate limiting

-- ---------------------------------------------------------------------------
-- Products: channel fields + updated_at
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS publish_to_souqna BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE products SET updated_at = created_at WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Online orders: Souqna source + delivery metadata
-- ---------------------------------------------------------------------------
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'qr_menu',
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_area TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_online_orders_souqna_external
  ON online_orders(source, external_order_id)
  WHERE source = 'souqna' AND external_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Integration logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS souqna_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_souqna_integration_logs_org_created
  ON souqna_integration_logs(org_id, created_at DESC);

ALTER TABLE souqna_integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY souqna_integration_logs_select ON souqna_integration_logs FOR SELECT
  USING (
    org_id = auth_org_id()
    AND (
      is_privileged_role()
      OR has_permission('settings_manage')
      OR has_permission('audit_view')
    )
  );

CREATE POLICY souqna_integration_logs_no_direct_write ON souqna_integration_logs
  FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS souqna_api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash_prefix TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_souqna_api_requests_prefix_time
  ON souqna_api_requests(api_key_hash_prefix, requested_at DESC);

ALTER TABLE souqna_api_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY souqna_api_requests_no_direct ON souqna_api_requests
  FOR ALL USING (false);

CREATE OR REPLACE FUNCTION record_souqna_api_request(p_prefix TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO souqna_api_requests (api_key_hash_prefix) VALUES (p_prefix);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION assert_souqna_rate_limit(p_prefix TEXT)
RETURNS VOID AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM souqna_api_requests
  WHERE api_key_hash_prefix = p_prefix
    AND requested_at > now() - interval '1 minute';

  IF v_count >= 120 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  PERFORM record_souqna_api_request(p_prefix);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_souqna_api_request TO service_role;
GRANT EXECUTE ON FUNCTION assert_souqna_rate_limit TO service_role;

-- ---------------------------------------------------------------------------
-- Stock reservation movement type (extend enum)
-- ---------------------------------------------------------------------------
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'reservation';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'reservation_release';
