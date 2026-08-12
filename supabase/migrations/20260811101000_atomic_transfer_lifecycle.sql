-- A transfer status must never advance unless every related stock movement succeeds.

CREATE OR REPLACE FUNCTION public.send_transfer_atomic(
  p_transfer_id uuid,
  p_user_id uuid,
  p_prevent_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.transfer_orders%ROWTYPE;
  v_line record;
  v_line_count integer;
BEGIN
  SELECT * INTO v_transfer
  FROM public.transfer_orders
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status <> 'draft' THEN RAISE EXCEPTION 'Transfer already sent'; END IF;
  IF public.is_period_closed(v_transfer.from_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  SELECT count(*) INTO v_line_count
  FROM public.transfer_order_lines
  WHERE transfer_id = p_transfer_id;
  IF v_line_count = 0 THEN RAISE EXCEPTION 'Add at least one line'; END IF;

  FOR v_line IN
    SELECT l.*, p.track_inventory, p.base_unit
    FROM public.transfer_order_lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE l.transfer_id = p_transfer_id
    ORDER BY l.id
  LOOP
    IF v_line.quantity_sent <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;
    IF v_line.track_inventory THEN
      PERFORM public.adjust_inventory_stock(
        p_store_id => v_transfer.from_store_id,
        p_warehouse_id => v_transfer.from_warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => -v_line.quantity_sent,
        p_movement_type => 'transfer_out',
        p_reference_type => 'transfer_order',
        p_reference_id => p_transfer_id,
        p_reason => NULL,
        p_created_by => p_user_id,
        p_prevent_negative => p_prevent_negative,
        p_batch_number => v_line.batch_number,
        p_batch_source_type => 'transfer',
        p_batch_source_document_id => p_transfer_id,
        p_batch_unit => v_line.base_unit
      );
    END IF;
  END LOOP;

  UPDATE public.transfer_orders
  SET status = 'sent', sent_at = now()
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  PERFORM public.insert_audit_log(
    'transfer.sent', 'transfer_order', p_transfer_id::text,
    v_transfer.from_store_id, '{}'::jsonb
  );
  RETURN to_jsonb(v_transfer);
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_transfer_atomic(
  p_transfer_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.transfer_orders%ROWTYPE;
  v_line record;
BEGIN
  SELECT * INTO v_transfer
  FROM public.transfer_orders
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status <> 'sent' THEN RAISE EXCEPTION 'Transfer must be sent first'; END IF;
  IF public.is_period_closed(v_transfer.to_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  FOR v_line IN
    SELECT l.*, p.track_inventory, p.base_unit
    FROM public.transfer_order_lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE l.transfer_id = p_transfer_id
    ORDER BY l.id
  LOOP
    IF v_line.track_inventory THEN
      PERFORM public.adjust_inventory_stock(
        p_store_id => v_transfer.to_store_id,
        p_warehouse_id => v_transfer.to_warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => v_line.quantity_sent,
        p_movement_type => 'transfer_in',
        p_reference_type => 'transfer_order',
        p_reference_id => p_transfer_id,
        p_reason => NULL,
        p_created_by => p_user_id,
        p_prevent_negative => false,
        p_batch_number => v_line.batch_number,
        p_batch_source_type => 'transfer',
        p_batch_source_document_id => p_transfer_id,
        p_batch_unit => v_line.base_unit
      );
    END IF;

    UPDATE public.transfer_order_lines
    SET quantity_received = quantity_sent
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.transfer_orders
  SET status = 'received', received_at = now()
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  PERFORM public.insert_audit_log(
    'transfer.received', 'transfer_order', p_transfer_id::text,
    v_transfer.to_store_id, '{}'::jsonb
  );
  RETURN to_jsonb(v_transfer);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_transfer_atomic(
  p_transfer_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer public.transfer_orders%ROWTYPE;
  v_previous_status public.transfer_status;
  v_line record;
BEGIN
  SELECT * INTO v_transfer
  FROM public.transfer_orders
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status = 'draft' THEN
    RAISE EXCEPTION 'Delete draft transfers instead of voiding';
  END IF;
  IF v_transfer.status = 'cancelled' THEN RAISE EXCEPTION 'Transfer already cancelled'; END IF;
  IF v_transfer.status NOT IN ('sent', 'received') THEN
    RAISE EXCEPTION 'Cannot void transfer in this status';
  END IF;

  v_previous_status := v_transfer.status;
  IF public.is_period_closed(v_transfer.from_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;
  IF v_transfer.status = 'received'
     AND public.is_period_closed(v_transfer.to_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  FOR v_line IN
    SELECT l.*, p.track_inventory, p.base_unit
    FROM public.transfer_order_lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE l.transfer_id = p_transfer_id
    ORDER BY l.id
  LOOP
    IF v_line.track_inventory AND v_transfer.status = 'received' THEN
      PERFORM public.adjust_inventory_stock(
        p_store_id => v_transfer.to_store_id,
        p_warehouse_id => v_transfer.to_warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => -v_line.quantity_sent,
        p_movement_type => 'transfer_in',
        p_reference_type => 'transfer_order',
        p_reference_id => p_transfer_id,
        p_reason => 'void_transfer',
        p_created_by => p_user_id,
        p_prevent_negative => true,
        p_batch_number => v_line.batch_number,
        p_batch_source_type => 'transfer',
        p_batch_source_document_id => p_transfer_id,
        p_batch_unit => v_line.base_unit
      );
    END IF;

    IF v_line.track_inventory THEN
      PERFORM public.adjust_inventory_stock(
        p_store_id => v_transfer.from_store_id,
        p_warehouse_id => v_transfer.from_warehouse_id,
        p_product_id => v_line.product_id,
        p_variant_id => v_line.variant_id,
        p_quantity_delta => v_line.quantity_sent,
        p_movement_type => 'transfer_out',
        p_reference_type => 'transfer_order',
        p_reference_id => p_transfer_id,
        p_reason => 'void_transfer',
        p_created_by => p_user_id,
        p_prevent_negative => false,
        p_batch_number => v_line.batch_number,
        p_batch_source_type => 'transfer',
        p_batch_source_document_id => p_transfer_id,
        p_batch_unit => v_line.base_unit
      );
    END IF;
  END LOOP;

  UPDATE public.transfer_orders
  SET status = 'cancelled'
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  PERFORM public.insert_audit_log(
    'transfer.voided', 'transfer_order', p_transfer_id::text,
    v_transfer.from_store_id,
    jsonb_build_object('previousStatus', v_previous_status)
  );
  RETURN to_jsonb(v_transfer);
END;
$$;

REVOKE ALL ON FUNCTION public.send_transfer_atomic(uuid, uuid, boolean)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.receive_transfer_atomic(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.void_transfer_atomic(uuid, uuid)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.send_transfer_atomic(uuid, uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_transfer_atomic(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_transfer_atomic(uuid, uuid)
  TO authenticated;
