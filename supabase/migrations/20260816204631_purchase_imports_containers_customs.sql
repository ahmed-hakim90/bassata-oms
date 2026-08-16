-- Purchase imports: containers, customs certificates, document FX (EGP books).
-- Feature flag `purchase_imports` is app-side only (default off; never activity preset).

CREATE TYPE public.purchase_container_status AS ENUM (
  'planned',
  'shipped',
  'at_port',
  'inland',
  'received',
  'cancelled'
);

CREATE TYPE public.customs_certificate_status AS ENUM (
  'open',
  'closed'
);

CREATE TYPE public.customs_certificate_cost_type AS ENUM (
  'customs',
  'port',
  'demurrage',
  'inland',
  'agent',
  'other'
);

ALTER TYPE public.journal_source ADD VALUE IF NOT EXISTS 'customs_certificate';

-- FX + container link on purchase documents (additive; local EGP docs keep currency default + fx_rate 1).
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS fx_rate numeric(18, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS container_id uuid;

ALTER TABLE public.purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS foreign_unit_cost numeric(12, 4),
  ADD COLUMN IF NOT EXISTS foreign_line_total numeric(12, 2);

ALTER TABLE public.purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_fx_rate_positive;
ALTER TABLE public.purchase_invoices
  ADD CONSTRAINT purchase_invoices_fx_rate_positive CHECK (fx_rate > 0);

CREATE TABLE public.customs_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores (id),
  certificate_number text NOT NULL,
  status public.customs_certificate_status NOT NULL DEFAULT 'open',
  certificate_date date NOT NULL DEFAULT (CURRENT_DATE),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT customs_certificates_org_number_unique UNIQUE (org_id, certificate_number)
);

CREATE TABLE public.purchase_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores (id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_invoices (id) ON DELETE RESTRICT,
  customs_certificate_id uuid REFERENCES public.customs_certificates (id) ON DELETE SET NULL,
  container_number text NOT NULL,
  status public.purchase_container_status NOT NULL DEFAULT 'planned',
  shipped_at date,
  arrived_port_at date,
  received_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_containers_org_number_unique UNIQUE (org_id, container_number)
);

CREATE TABLE public.purchase_container_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.purchase_containers (id) ON DELETE CASCADE,
  source_line_id uuid NOT NULL REFERENCES public.purchase_invoice_lines (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id),
  variant_id uuid REFERENCES public.product_variants (id),
  quantity numeric(12, 4) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customs_certificate_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.customs_certificates (id) ON DELETE CASCADE,
  cost_type public.customs_certificate_cost_type NOT NULL DEFAULT 'other',
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  payee_supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  payment_method public.expense_payment_method,
  notes text NOT NULL DEFAULT '',
  /** Amount already posted to GL (inventory capitalization). Delta posted on sync. */
  posted_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (posted_amount >= 0),
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_containers_org_status
  ON public.purchase_containers (org_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_containers_po
  ON public.purchase_containers (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_containers_certificate
  ON public.purchase_containers (customs_certificate_id);
CREATE INDEX IF NOT EXISTS idx_purchase_container_lines_container
  ON public.purchase_container_lines (container_id);
CREATE INDEX IF NOT EXISTS idx_purchase_container_lines_source
  ON public.purchase_container_lines (source_line_id);
CREATE INDEX IF NOT EXISTS idx_customs_certificates_org
  ON public.customs_certificates (org_id, status);
CREATE INDEX IF NOT EXISTS idx_customs_certificate_costs_cert
  ON public.customs_certificate_costs (certificate_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_container
  ON public.purchase_invoices (container_id);

ALTER TABLE public.purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_container_id_fkey;
ALTER TABLE public.purchase_invoices
  ADD CONSTRAINT purchase_invoices_container_id_fkey
  FOREIGN KEY (container_id) REFERENCES public.purchase_containers (id) ON DELETE SET NULL;

ALTER TABLE public.customs_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_container_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_certificate_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY customs_certificates_store ON public.customs_certificates FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY purchase_containers_store ON public.purchase_containers FOR ALL
  USING (has_store_access(store_id))
  WITH CHECK (has_store_access(store_id));

CREATE POLICY purchase_container_lines_child ON public.purchase_container_lines FOR ALL
  USING (
    container_id IN (
      SELECT id FROM public.purchase_containers WHERE has_store_access(store_id)
    )
  )
  WITH CHECK (
    container_id IN (
      SELECT id FROM public.purchase_containers WHERE has_store_access(store_id)
    )
  );

CREATE POLICY customs_certificate_costs_child ON public.customs_certificate_costs FOR ALL
  USING (
    certificate_id IN (
      SELECT id FROM public.customs_certificates WHERE has_store_access(store_id)
    )
  )
  WITH CHECK (
    certificate_id IN (
      SELECT id FROM public.customs_certificates WHERE has_store_access(store_id)
    )
  );

COMMENT ON TABLE public.purchase_containers IS
  'Shipping containers on a purchase order; stock enters warehouse when container is received.';
COMMENT ON TABLE public.customs_certificates IS
  'Official customs certificate grouping containers and port-to-warehouse costs.';
COMMENT ON COLUMN public.purchase_invoices.currency IS
  'Document currency (USD for imports). Books remain org currency via fx_rate.';
COMMENT ON COLUMN public.purchase_invoices.fx_rate IS
  'Multiply foreign amounts by this rate to get org currency (EGP).';
