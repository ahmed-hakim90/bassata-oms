-- Separate transaction from ADD VALUE so new enum labels can be used in CHECKs.
-- POS orders stay document_kind IS NULL AND document_status IS NULL.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sales_kind_status_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_sales_kind_status_chk CHECK (
    (document_kind IS NULL AND document_status IS NULL)
    OR (
      document_kind = 'quotation'
      AND document_status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')
    )
    OR (
      document_kind = 'sales_order'
      AND document_status IN ('draft', 'confirmed', 'cancelled', 'invoiced')
    )
    OR (
      document_kind = 'sales_invoice'
      AND document_status IN ('draft', 'issued', 'delivered', 'cancelled')
    )
    OR (
      document_kind = 'credit_note'
      AND document_status IN ('draft', 'issued')
    )
  );

ALTER TABLE public.purchase_invoices DROP CONSTRAINT IF EXISTS purchase_kind_status_chk;
ALTER TABLE public.purchase_invoices
  ADD CONSTRAINT purchase_kind_status_chk CHECK (
    (
      document_kind = 'purchase_request'
      AND status IN ('draft', 'submitted', 'approved', 'rejected', 'invoiced')
    )
    OR (
      document_kind = 'purchase_order'
      AND status IN ('draft', 'sent', 'partial_invoiced', 'invoiced', 'cancelled')
    )
    OR (
      document_kind = 'purchase_invoice'
      AND status IN ('draft', 'received', 'cancelled')
    )
    OR (
      document_kind = 'purchase_return'
      AND status IN ('draft', 'posted', 'cancelled')
    )
  );
