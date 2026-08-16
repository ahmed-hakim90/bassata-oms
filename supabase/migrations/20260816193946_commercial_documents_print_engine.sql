-- Commercial documents (sales + purchases), numbering, credit notes, purchase returns.
-- Print engine settings live in app_settings (no template table).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.sales_document_kind AS ENUM (
    'quotation',
    'sales_order',
    'sales_invoice',
    'credit_note'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.purchase_document_kind AS ENUM (
    'purchase_request',
    'purchase_order',
    'purchase_invoice',
    'purchase_return'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.sales_document_status ADD VALUE IF NOT EXISTS 'invoiced';

ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'partial_invoiced';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'posted';

-- ---------------------------------------------------------------------------
-- Party legal fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_id TEXT NOT NULL DEFAULT '';

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_id TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Sales document columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS document_kind public.sales_document_kind,
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS document_notes TEXT NOT NULL DEFAULT '';

UPDATE public.orders
SET document_kind = 'sales_invoice'
WHERE document_status IS NOT NULL
  AND document_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_document_kind
  ON public.orders (store_id, document_kind)
  WHERE document_kind IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_document
  ON public.orders (source_document_id)
  WHERE source_document_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Purchase document columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_invoices
  ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS document_kind public.purchase_document_kind NOT NULL DEFAULT 'purchase_invoice',
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.purchase_invoices(id),
  ADD COLUMN IF NOT EXISTS document_notes TEXT NOT NULL DEFAULT '';

UPDATE public.purchase_invoices
SET document_kind = 'purchase_invoice'
WHERE document_kind IS NULL;

ALTER TABLE public.purchase_invoice_lines
  ADD COLUMN IF NOT EXISTS source_line_id UUID REFERENCES public.purchase_invoice_lines(id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_store_kind
  ON public.purchase_invoices (store_id, document_kind);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_source
  ON public.purchase_invoices (source_document_id)
  WHERE source_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_lines_source_line
  ON public.purchase_invoice_lines (source_line_id)
  WHERE source_line_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_counters (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  business_date DATE NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, kind, business_date)
);

ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_number_counters_no_direct_access ON public.document_number_counters;
CREATE POLICY document_number_counters_no_direct_access
  ON public.document_number_counters
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.next_document_number(
  p_store_id UUID,
  p_kind TEXT,
  p_business_date DATE
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_next INT;
  v_prefix TEXT;
BEGIN
  IF p_store_id IS NULL OR p_kind IS NULL OR p_business_date IS NULL THEN
    RAISE EXCEPTION 'Document number arguments required';
  END IF;

  v_prefix := CASE p_kind
    WHEN 'quotation' THEN 'QT'
    WHEN 'sales_order' THEN 'SO'
    WHEN 'sales_invoice' THEN 'SI'
    WHEN 'credit_note' THEN 'CN'
    WHEN 'purchase_request' THEN 'PR'
    WHEN 'purchase_order' THEN 'PO'
    WHEN 'purchase_invoice' THEN 'PI'
    WHEN 'purchase_return' THEN 'RT'
    ELSE NULL
  END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Unknown document kind';
  END IF;

  INSERT INTO public.document_number_counters (store_id, kind, business_date, last_number)
  VALUES (p_store_id, p_kind, p_business_date, 1)
  ON CONFLICT (store_id, kind, business_date)
  DO UPDATE SET last_number = public.document_number_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_prefix
    || '-'
    || to_char(p_business_date, 'YYYYMMDD')
    || '-'
    || lpad(v_next::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(UUID, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Kind/status guards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_document_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_kind IS DISTINCT FROM OLD.document_kind
     AND OLD.document_kind IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot change document kind';
  END IF;
  IF NEW.document_status = 'delivered'
     AND COALESCE(NEW.document_kind, 'sales_invoice') IS DISTINCT FROM 'sales_invoice' THEN
    RAISE EXCEPTION 'Only sales invoices can be delivered';
  END IF;
  IF NEW.document_kind IS NULL AND NEW.document_status IS NOT NULL THEN
    RAISE EXCEPTION 'POS orders cannot carry a document status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_document_lifecycle_guard ON public.orders;
CREATE TRIGGER trg_sales_document_lifecycle_guard
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_document_lifecycle_guard();

CREATE OR REPLACE FUNCTION public.purchase_document_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_kind IS DISTINCT FROM OLD.document_kind
     AND TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Cannot change purchase document kind';
  END IF;
  IF NEW.status = 'received'
     AND NEW.document_kind IS DISTINCT FROM 'purchase_invoice' THEN
    RAISE EXCEPTION 'Only purchase invoices can be received';
  END IF;
  IF NEW.document_kind IS DISTINCT FROM 'purchase_request'
     AND NEW.supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_document_lifecycle_guard ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_document_lifecycle_guard
  BEFORE INSERT OR UPDATE ON public.purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.purchase_document_lifecycle_guard();

-- ---------------------------------------------------------------------------
-- Credit note issue (AR reverse + optional restock of CN lines)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_sales_credit_note(
  p_order_id UUID,
  p_restock BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_caller UUID;
  v_note RECORD;
  v_source RECORD;
  v_line RECORD;
  v_source_qty NUMERIC;
  v_used_qty NUMERIC;
  v_line_count INT;
  v_restock_count INT := 0;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  v_caller := auth_app_user_id();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF NOT (has_permission('checkout_create') OR is_privileged_role()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT o.*
  INTO v_note
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Credit note not found'; END IF;
  IF NOT has_store_access(v_note.store_id) THEN RAISE EXCEPTION 'Store access denied'; END IF;
  IF v_note.document_kind IS DISTINCT FROM 'credit_note' THEN
    RAISE EXCEPTION 'Not a credit note';
  END IF;
  IF v_note.document_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft credit notes can be issued';
  END IF;
  IF v_note.customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer is required';
  END IF;
  IF v_note.source_document_id IS NULL THEN
    RAISE EXCEPTION 'Credit note must reference a sales invoice';
  END IF;

  SELECT COUNT(*) INTO v_line_count FROM order_items WHERE order_id = p_order_id;
  IF v_line_count = 0 THEN RAISE EXCEPTION 'Add at least one line'; END IF;

  SELECT o.*
  INTO v_source
  FROM orders o
  WHERE o.id = v_note.source_document_id
  FOR UPDATE OF o;

  IF NOT FOUND
     OR v_source.store_id IS DISTINCT FROM v_note.store_id
     OR v_source.document_kind IS DISTINCT FROM 'sales_invoice'
     OR v_source.document_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'Credit note source must be a delivered sales invoice';
  END IF;

  FOR v_line IN
    SELECT product_id, variant_id, SUM(quantity) AS qty
    FROM order_items
    WHERE order_id = p_order_id
    GROUP BY product_id, variant_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_source_qty
    FROM order_items
    WHERE order_id = v_source.id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id;

    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_used_qty
    FROM order_items oi
    JOIN orders cn ON cn.id = oi.order_id
    WHERE cn.source_document_id = v_source.id
      AND cn.document_kind = 'credit_note'
      AND cn.document_status = 'issued'
      AND oi.product_id = v_line.product_id
      AND oi.variant_id IS NOT DISTINCT FROM v_line.variant_id;

    IF v_line.qty > (v_source_qty - v_used_qty) THEN
      RAISE EXCEPTION 'Credit quantity exceeds remaining invoiced quantity';
    END IF;
  END LOOP;

  IF p_restock AND v_note.warehouse_id IS NOT NULL THEN
    FOR v_line IN
      SELECT oi.*, p.track_inventory
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id
    LOOP
      IF v_line.track_inventory AND v_line.quantity > 0 THEN
        PERFORM public.adjust_inventory_stock(
          p_store_id => v_note.store_id,
          p_warehouse_id => v_note.warehouse_id,
          p_product_id => v_line.product_id,
          p_variant_id => v_line.variant_id,
          p_quantity_delta => v_line.quantity,
          p_movement_type => 'adjustment',
          p_reference_type => 'credit_note',
          p_reference_id => p_order_id,
          p_reason => 'Sales credit note restock',
          p_created_by => v_caller,
          p_prevent_negative => false
        );
        v_restock_count := v_restock_count + 1;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO customer_ledger (
    org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
  ) VALUES (
    v_org_id,
    v_note.store_id,
    v_note.customer_id,
    'refund',
    0,
    v_note.total,
    p_order_id,
    v_note.order_number,
    v_caller
  );

  UPDATE customers
  SET account_balance = account_balance - v_note.total
  WHERE id = v_note.customer_id
    AND org_id = v_org_id;

  UPDATE orders
  SET document_status = 'issued',
      issued_at = NOW()
  WHERE id = p_order_id;

  PERFORM insert_audit_log(
    'sales_credit_note.issued',
    'order',
    p_order_id::text,
    v_note.store_id,
    jsonb_build_object(
      'order_number', v_note.order_number,
      'total', v_note.total,
      'restock_lines', v_restock_count
    )
  );

  RETURN jsonb_build_object(
    'id', p_order_id,
    'status', 'issued',
    'order_number', v_note.order_number,
    'total', v_note.total,
    'restock_lines', v_restock_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_sales_credit_note(UUID, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_sales_credit_note(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Purchase return post (stock out + AP credit via received_at timestamp)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_purchase_return(
  p_invoice_id UUID,
  p_user_id UUID,
  p_prevent_negative BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_doc public.purchase_invoices%ROWTYPE;
  v_source public.purchase_invoices%ROWTYPE;
  v_org_id UUID;
  v_line RECORD;
  v_source_qty NUMERIC;
  v_used_qty NUMERIC;
  v_line_count INT;
  v_occurred_at TIMESTAMPTZ;
BEGIN
  IF auth.role() = 'authenticated' AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.auth_user_id = auth.uid() AND u.is_active
  ) THEN
    RAISE EXCEPTION 'Authenticated user does not match actor';
  END IF;

  SELECT * INTO v_doc
  FROM public.purchase_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase return not found'; END IF;
  IF v_doc.document_kind IS DISTINCT FROM 'purchase_return' THEN
    RAISE EXCEPTION 'Not a purchase return';
  END IF;
  IF v_doc.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft purchase returns can be posted';
  END IF;
  IF v_doc.supplier_id IS NULL THEN RAISE EXCEPTION 'Supplier is required'; END IF;
  IF v_doc.source_document_id IS NULL THEN
    RAISE EXCEPTION 'Return must reference a received purchase invoice';
  END IF;

  SELECT count(*) INTO v_line_count
  FROM public.purchase_invoice_lines
  WHERE invoice_id = p_invoice_id;
  IF v_line_count = 0 THEN RAISE EXCEPTION 'Add at least one line'; END IF;

  SELECT * INTO v_source
  FROM public.purchase_invoices
  WHERE id = v_doc.source_document_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_source.document_kind IS DISTINCT FROM 'purchase_invoice'
     OR v_source.status IS DISTINCT FROM 'received'
     OR v_source.store_id IS DISTINCT FROM v_doc.store_id THEN
    RAISE EXCEPTION 'Return source must be a received purchase invoice';
  END IF;

  v_occurred_at := (COALESCE(v_doc.document_date, CURRENT_DATE)::text || 'T12:00:00.000Z')::timestamptz;
  IF public.is_period_closed(v_doc.store_id, v_occurred_at) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  SELECT s.org_id INTO v_org_id FROM public.stores s WHERE s.id = v_doc.store_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;

  FOR v_line IN
    SELECT product_id, variant_id, SUM(quantity) AS qty
    FROM public.purchase_invoice_lines
    WHERE invoice_id = p_invoice_id
    GROUP BY product_id, variant_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_source_qty
    FROM public.purchase_invoice_lines
    WHERE invoice_id = v_source.id
      AND product_id = v_line.product_id
      AND variant_id IS NOT DISTINCT FROM v_line.variant_id;

    SELECT COALESCE(SUM(l.quantity), 0) INTO v_used_qty
    FROM public.purchase_invoice_lines l
    JOIN public.purchase_invoices r ON r.id = l.invoice_id
    WHERE r.source_document_id = v_source.id
      AND r.document_kind = 'purchase_return'
      AND r.status = 'posted'
      AND l.product_id = v_line.product_id
      AND l.variant_id IS NOT DISTINCT FROM v_line.variant_id;

    IF v_line.qty > (v_source_qty - v_used_qty) THEN
      RAISE EXCEPTION 'Return quantity exceeds remaining received quantity';
    END IF;
  END LOOP;

  FOR v_line IN
    SELECT l.*, p.track_inventory
    FROM public.purchase_invoice_lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE l.invoice_id = p_invoice_id
  LOOP
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be positive';
    END IF;
    IF v_line.track_inventory THEN
      PERFORM public.adjust_inventory_stock(
        p_store_id => v_doc.store_id,
        p_warehouse_id => v_doc.warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => -v_line.quantity,
        p_movement_type => 'adjustment',
        p_reference_type => 'purchase_return',
        p_reference_id => p_invoice_id,
        p_reason => 'Purchase return to supplier',
        p_created_by => p_user_id,
        p_prevent_negative => p_prevent_negative,
        p_created_at => v_occurred_at
      );
    END IF;
  END LOOP;

  UPDATE public.purchase_invoices
  SET status = 'posted',
      received_at = v_occurred_at
  WHERE id = p_invoice_id;

  PERFORM public.insert_audit_log(
    'purchase_return.posted',
    'purchase_invoice',
    p_invoice_id::text,
    v_doc.store_id,
    jsonb_build_object('invoice_number', v_doc.invoice_number, 'total', v_doc.total)
  );

  RETURN jsonb_build_object(
    'id', p_invoice_id,
    'status', 'posted',
    'invoice_number', v_doc.invoice_number,
    'total', v_doc.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_purchase_return(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.post_purchase_return(UUID, UUID, BOOLEAN) TO authenticated;

