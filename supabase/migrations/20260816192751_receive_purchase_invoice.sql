-- Receive a draft purchase invoice in one transaction: landed costs, stock,
-- last_unit_cost, status, optional supplier payment, and audit.

CREATE OR REPLACE FUNCTION public.receive_purchase_invoice(
  p_invoice_id uuid,
  p_user_id uuid,
  p_amount_paid numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_prevent_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.purchase_invoices%ROWTYPE;
  v_warehouse public.warehouses%ROWTYPE;
  v_org_id uuid;
  v_line record;
  v_line_count integer;
  v_subtotal numeric(12,2);
  v_extra numeric(12,2);
  v_allocated_extra numeric(12,2) := 0;
  v_line_extra numeric(12,2);
  v_landed_line numeric(12,2);
  v_landed_unit numeric(12,4);
  v_line_idx integer := 0;
  v_document_date date;
  v_occurred_at timestamptz;
  v_received_date date;
  v_batch_number text;
  v_expiry date;
  v_amount_paid numeric(12,2);
  v_payment_method text;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_invoice
  FROM public.purchase_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_invoice.status = 'received' THEN
    RAISE EXCEPTION 'Already received';
  END IF;
  IF v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft purchases can be received';
  END IF;

  v_document_date := COALESCE(v_invoice.document_date, CURRENT_DATE);
  v_occurred_at := (v_document_date::text || 'T12:00:00.000Z')::timestamptz;
  v_received_date := v_document_date;

  IF public.is_period_closed(v_invoice.store_id, v_occurred_at) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  v_amount_paid := COALESCE(p_amount_paid, 0);
  IF v_amount_paid < 0 THEN
    RAISE EXCEPTION 'مبلغ الدفعة لازم يكون صفر أو أكبر';
  END IF;
  IF v_amount_paid > v_invoice.total THEN
    RAISE EXCEPTION 'مبلغ الدفعة لا يمكن أن يتجاوز إجمالي الفاتورة';
  END IF;

  IF v_amount_paid > 0 THEN
    v_payment_method := COALESCE(NULLIF(btrim(p_payment_method), ''), 'cash');
    IF v_payment_method = 'credit' THEN
      RAISE EXCEPTION 'Cannot record a supplier payment as credit';
    END IF;
  END IF;

  SELECT * INTO v_warehouse
  FROM public.warehouses
  WHERE id = v_invoice.warehouse_id;

  IF NOT FOUND
     OR v_warehouse.store_id <> v_invoice.store_id
     OR NOT v_warehouse.is_active THEN
    RAISE EXCEPTION 'المخزن لا يتبع الفرع المحدد أو أنه غير نشط';
  END IF;

  SELECT s.org_id INTO v_org_id
  FROM public.stores s
  WHERE s.id = v_invoice.store_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  SELECT count(*), COALESCE(sum(line_total), 0)
  INTO v_line_count, v_subtotal
  FROM public.purchase_invoice_lines
  WHERE invoice_id = p_invoice_id;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Add at least one line';
  END IF;

  v_extra := COALESCE(v_invoice.extra_cost, 0);

  FOR v_line IN
    SELECT
      l.*,
      p.track_inventory,
      p.base_unit,
      p.unit,
      p.cost_unit,
      p.shelf_life_value,
      p.shelf_life_unit
    FROM public.purchase_invoice_lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE l.invoice_id = p_invoice_id
    ORDER BY l.id
  LOOP
    v_line_idx := v_line_idx + 1;

    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Purchase quantity must be positive';
    END IF;

    -- Match allocateLandedCosts: proportional extra, last line absorbs remainder.
    IF v_subtotal > 0 THEN
      IF v_line_idx = v_line_count THEN
        v_line_extra := round(v_extra - v_allocated_extra, 2);
      ELSE
        v_line_extra := round(v_extra * (v_line.line_total / v_subtotal), 2);
      END IF;
    ELSE
      IF v_line_idx = v_line_count THEN
        v_line_extra := round(v_extra - v_allocated_extra, 2);
      ELSE
        v_line_extra := round(v_extra / v_line_count, 2);
      END IF;
    END IF;
    v_allocated_extra := v_allocated_extra + v_line_extra;
    v_landed_line := round(v_line.line_total + v_line_extra, 2);
    v_landed_unit := CASE
      WHEN v_line.quantity > 0 THEN round(v_landed_line / v_line.quantity, 4)
      ELSE v_line.unit_cost
    END;

    UPDATE public.purchase_invoice_lines
    SET
      landed_unit_cost = v_landed_unit,
      landed_line_total = v_landed_line
    WHERE id = v_line.id;

    IF v_line.track_inventory THEN
      v_batch_number := NULLIF(btrim(v_line.batch_number), '');
      IF v_batch_number IS NULL THEN
        v_batch_number :=
          v_invoice.invoice_number
          || '-'
          || left(v_line.product_id::text, 6)
          || '-'
          || left(v_line.id::text, 6);
      END IF;

      v_expiry := COALESCE(
        v_line.expiry_date,
        public.calculate_product_expiry_date(
          v_line.production_date,
          v_line.shelf_life_value,
          v_line.shelf_life_unit
        )
      );

      PERFORM public.adjust_inventory_stock(
        p_store_id => v_invoice.store_id,
        p_warehouse_id => v_invoice.warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => v_line.quantity,
        p_movement_type => 'purchase',
        p_reference_type => 'purchase_invoice',
        p_reference_id => p_invoice_id,
        p_reason => NULL,
        p_created_by => p_user_id,
        p_prevent_negative => p_prevent_negative,
        p_batch_number => v_batch_number,
        p_batch_production_date => v_line.production_date,
        p_batch_expiry_date => v_expiry,
        p_batch_received_date => v_received_date,
        p_batch_supplier_id => v_invoice.supplier_id,
        p_batch_purchase_invoice_id => v_invoice.id,
        p_batch_source_type => 'purchase',
        p_batch_source_document_id => v_invoice.id,
        p_batch_unit => COALESCE(v_line.base_unit, v_line.unit),
        p_created_at => v_occurred_at
      );
    END IF;

    -- Last landed unit cost wins per product (same as TS Map overwrite).
    UPDATE public.products
    SET
      last_unit_cost = v_landed_unit,
      cost_unit = COALESCE(cost_unit, unit)
    WHERE id = v_line.product_id;
  END LOOP;

  UPDATE public.purchase_invoices
  SET
    status = 'received',
    document_date = v_document_date,
    received_at = v_occurred_at
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  IF v_amount_paid > 0 THEN
    INSERT INTO public.supplier_payments (
      org_id,
      store_id,
      supplier_id,
      amount,
      payment_method,
      reference,
      notes,
      paid_at,
      created_by
    )
    VALUES (
      v_org_id,
      v_invoice.store_id,
      v_invoice.supplier_id,
      v_amount_paid,
      v_payment_method,
      v_invoice.invoice_number,
      'دفعة مع استلام فاتورة ' || v_invoice.invoice_number,
      v_occurred_at,
      p_user_id
    )
    RETURNING id INTO v_payment_id;

    PERFORM public.insert_audit_log(
      'supplier_payment.created',
      'supplier_payment',
      v_payment_id::text,
      v_invoice.store_id,
      jsonb_build_object(
        'amount', v_amount_paid,
        'supplierId', v_invoice.supplier_id,
        'paymentMethod', v_payment_method,
        'purchaseInvoiceId', p_invoice_id
      )
    );
  END IF;

  PERFORM public.insert_audit_log(
    'purchase.received',
    'purchase_invoice',
    p_invoice_id::text,
    v_invoice.store_id,
    jsonb_build_object(
      'total', v_invoice.total,
      'lineCount', v_line_count,
      'amountPaid', v_amount_paid
    )
  );

  RETURN jsonb_build_object(
    'id', v_invoice.id,
    'store_id', v_invoice.store_id,
    'warehouse_id', v_invoice.warehouse_id,
    'supplier_id', v_invoice.supplier_id,
    'invoice_number', v_invoice.invoice_number,
    'status', v_invoice.status,
    'subtotal', v_invoice.subtotal,
    'extra_cost', v_invoice.extra_cost,
    'tax', v_invoice.tax,
    'total', v_invoice.total,
    'document_date', v_invoice.document_date,
    'received_at', v_invoice.received_at,
    'cancelled_at', v_invoice.cancelled_at,
    'created_by', v_invoice.created_by,
    'created_at', v_invoice.created_at,
    'amount_paid', v_amount_paid,
    'payment_method', v_payment_method,
    'line_count', v_line_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase_invoice(uuid, uuid, numeric, text, boolean)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.receive_purchase_invoice(uuid, uuid, numeric, text, boolean)
  TO authenticated;
