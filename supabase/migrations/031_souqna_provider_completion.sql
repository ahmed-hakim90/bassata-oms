-- Souqna provider completion: reserved stock + integration log fields

ALTER TABLE stock_levels
  ADD COLUMN IF NOT EXISTS reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE souqna_integration_logs
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS endpoint TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_souqna_integration_logs_org_type_created
  ON souqna_integration_logs(org_id, request_type, created_at DESC);
