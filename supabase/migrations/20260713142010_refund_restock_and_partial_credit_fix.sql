-- S09: Finish partial credit split (payment_status + ledger) and move refund/void
-- restock + credit reverse into Postgres RPC (ADR-007).
--
-- Refund restock policy:
--   Restock ONLY what was deducted at sale: reverse inventory_movements where
--   reference_type = 'order' and movement_type = 'sale' (quantity_delta < 0).
--   Restore amount = abs(quantity_delta) in stock units; batch restore uses the
--   existing trg_apply_order_return_inventory_batch_restore trigger.
--   If inventory_deduction was off at sale (no sale movements), restock is a no-op.
--   Credit AR reverse uses SUM(order_payments.amount WHERE method = 'credit'),
--   not orders.total (correct for partial credit splits).

-- ---------------------------------------------------------------------------
-- Shared reverse helper (stock + credit ledger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_order_stock_and_credit(
  p_order_id UUID,
  p_actor_id UUID,
  p_reference_type TEXT,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_order RECORD;
  v_sale RECORD;
  v_restore NUMERIC;
  v_restock_count INT := 0;
  v_restock_qty NUMERIC := 0;
  v_credit_amount NUMERIC := 0;
  v_existing INT;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;
  IF p_reference_type NOT IN ('order_refund', 'order_void') THEN
    RAISE EXCEPTION 'Invalid reverse reference type';
  END IF;

  SELECT o.*
  INTO v_order
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM inventory_movements
  WHERE reference_type IN ('order_refund', 'order_void')
    AND reference_id = p_order_id
    AND quantity_delta > 0;

  IF v_existing > 0 THEN
    RAISE EXCEPTION 'Order stock already reversed';
  END IF;

  FOR v_sale IN
    SELECT *
    FROM inventory_movements
    WHERE reference_type = 'order'
      AND reference_id = p_order_id
      AND movement_type = 'sale'
      AND quantity_delta < 0
    ORDER BY created_at ASC, id ASC
  LOOP
    v_restore := abs(v_sale.quantity_delta);

    UPDATE stock_levels
    SET quantity = quantity + v_restore,
        updated_at = now()
    WHERE store_id = v_order.store_id
      AND warehouse_id IS NOT DISTINCT FROM v_sale.warehouse_id
      AND product_id = v_sale.product_id
      AND variant_id IS NOT DISTINCT FROM v_sale.variant_id;

    IF NOT FOUND THEN
      INSERT INTO stock_levels (
        store_id, warehouse_id, product_id, variant_id, quantity, reorder_point
      ) VALUES (
        v_order.store_id,
        v_sale.warehouse_id,
        v_sale.product_id,
        v_sale.variant_id,
        v_restore,
        10
      );
    END IF;

    INSERT INTO inventory_movements (
      store_id, warehouse_id, product_id, variant_id, movement_type, quantity_delta,
      reference_type, reference_id, reason, created_by
    ) VALUES (
      v_order.store_id,
      v_sale.warehouse_id,
      v_sale.product_id,
      v_sale.variant_id,
      'adjustment',
      v_restore,
      p_reference_type,
      p_order_id,
      p_reason,
      p_actor_id
    );

    v_restock_count := v_restock_count + 1;
    v_restock_qty := v_restock_qty + v_restore;
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = p_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_order.customer_id IS NOT NULL THEN
    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, notes, created_by
    ) VALUES (
      v_org_id,
      v_order.store_id,
      v_order.customer_id,
      'refund',
      0,
      v_credit_amount,
      p_order_id,
      COALESCE(v_order.order_number, p_order_id::text),
      p_reason,
      p_actor_id
    );

    UPDATE customers
    SET account_balance = account_balance - v_credit_amount
    WHERE id = v_order.customer_id AND org_id = v_org_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'restocked', v_restock_count > 0,
    'restock_movement_count', v_restock_count,
    'restock_quantity_total', v_restock_qty,
    'credit_reversed', v_credit_amount,
    'reference_type', p_reference_type
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- refund_order / void_order RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_order(
  p_order_id UUID,
  p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_actor UUID;
  v_order RECORD;
  v_reverse JSONB;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_actor := COALESCE(p_actor_id, auth_app_user_id());
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;

  PERFORM require_feature('refunds');

  IF NOT has_permission('order_refund') THEN
    RAISE EXCEPTION 'Permission denied: order_refund';
  END IF;

  SELECT o.*
  INTO v_order
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed orders can be refunded';
  END IF;

  v_reverse := public.reverse_order_stock_and_credit(
    p_order_id, v_actor, 'order_refund', 'Order refunded'
  );

  UPDATE orders
  SET status = 'refunded'
  WHERE id = p_order_id;

  PERFORM insert_audit_log(
    'order.refunded',
    'order',
    p_order_id::text,
    v_order.store_id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'total', v_order.total,
      'restock', v_reverse
    )
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'refunded',
    'order_number', v_order.order_number,
    'total', v_order.total,
    'restock', v_reverse
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_order(
  p_order_id UUID,
  p_actor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_actor UUID;
  v_order RECORD;
  v_reverse JSONB;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_actor := COALESCE(p_actor_id, auth_app_user_id());
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;

  IF NOT has_permission('order_void') THEN
    RAISE EXCEPTION 'Permission denied: order_void';
  END IF;

  SELECT o.*
  INTO v_order
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.id = p_order_id
    AND s.org_id = v_org_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF v_order.status = 'voided' THEN
    RAISE EXCEPTION 'Order already voided';
  END IF;
  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'Cannot void a refunded order';
  END IF;

  v_reverse := public.reverse_order_stock_and_credit(
    p_order_id, v_actor, 'order_void', 'Order voided'
  );

  UPDATE orders
  SET status = 'voided'
  WHERE id = p_order_id;

  PERFORM insert_audit_log(
    'order.voided',
    'order',
    p_order_id::text,
    v_order.store_id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'total', v_order.total,
      'restock', v_reverse
    )
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'voided',
    'order_number', v_order.order_number,
    'total', v_order.total,
    'restock', v_reverse
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_order_stock_and_credit(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_order(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Partial credit split: persist payment_status after rewriting payments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_checkout_split(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_org_id UUID;
  v_flags JSONB := '{}'::jsonb;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_credit_count INT := 0;
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
  v_payment_status payment_status;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  -- When mixing credit with other tenders, complete the sale as non-credit first,
  -- then post only the credit portion to the customer ledger.
  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

  -- Reject wildly mismatched client totals before absorbing residual into last line.
  IF abs(round(v_payment_total, 2) - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
      v_payment_total, v_total;
  END IF;

  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;

    v_payment_status := 'partial';
  ELSIF v_credit_amount > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  UPDATE orders
  SET payment_status = v_payment_status
  WHERE id = v_order_id;

  RETURN v_result || jsonb_build_object(
    'payment_status', v_payment_status,
    'credit_amount', v_credit_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_checkout_split_expired_override(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_payment_method payment_method,
  p_discount NUMERIC,
  p_lines JSONB,
  p_payments JSONB,
  p_device_id UUID DEFAULT NULL,
  p_sales_mode sales_mode DEFAULT 'retail'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
  v_total NUMERIC;
  v_payment JSONB;
  v_method payment_method;
  v_amount NUMERIC;
  v_payment_total NUMERIC := 0;
  v_flags JSONB := '{}'::jsonb;
  v_org_id UUID;
  v_credit_count INT := 0;
  v_credit_amount NUMERIC := 0;
  v_payment_count INT;
  v_idx INT := 0;
  v_others NUMERIC := 0;
  v_last_amount NUMERIC;
  v_adjusted_payments JSONB := '[]'::jsonb;
  v_checkout_method payment_method;
  v_customer_balance NUMERIC;
  v_customer_limit NUMERIC;
  v_order_number TEXT;
  v_payment_status payment_status;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  SELECT value INTO v_flags FROM app_settings WHERE org_id = v_org_id AND key = 'feature_flags' LIMIT 1;
  v_flags := COALESCE(v_flags, '{}'::jsonb);
  v_payment_count := jsonb_array_length(p_payments);
  v_checkout_method := p_payment_method;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := (v_payment->>'method')::payment_method;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

    IF v_method = 'cash' AND COALESCE((v_flags->>'payment_cash')::boolean, true) = false THEN
      RAISE EXCEPTION 'Cash payments are disabled';
    END IF;
    IF v_method = 'card' AND COALESCE((v_flags->>'payment_card')::boolean, true) = false THEN
      RAISE EXCEPTION 'Card payments are disabled';
    END IF;
    IF v_method = 'other' AND COALESCE((v_flags->>'payment_other')::boolean, true) = false THEN
      RAISE EXCEPTION 'Other payments are disabled';
    END IF;
    IF v_method = 'wallet' AND COALESCE((v_flags->>'payment_wallet')::boolean, true) = false THEN
      RAISE EXCEPTION 'Wallet payments are disabled';
    END IF;
    IF v_method = 'credit' THEN
      v_credit_count := v_credit_count + 1;
      IF COALESCE((v_flags->>'credit_sales')::boolean, false) = false THEN
        RAISE EXCEPTION 'Credit sales are disabled';
      END IF;
    END IF;

    v_payment_total := v_payment_total + v_amount;
  END LOOP;

  IF v_credit_count > 1 THEN
    RAISE EXCEPTION 'Only one credit payment line is allowed';
  END IF;

  IF v_credit_count > 0 AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer required for credit sale';
  END IF;

  IF v_credit_count > 0 AND v_payment_count > 1 THEN
    v_checkout_method := NULL;
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_method := (v_payment->>'method')::payment_method;
      IF v_method <> 'credit' THEN
        v_checkout_method := v_method;
        EXIT;
      END IF;
    END LOOP;
    IF v_checkout_method IS NULL THEN
      RAISE EXCEPTION 'Mixed credit sale requires a non-credit payment';
    END IF;
  END IF;

  v_result := public.complete_checkout_expired_override(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    v_checkout_method,
    p_discount,
    p_lines,
    p_device_id,
    p_sales_mode
  );

  v_order_id := (v_result->>'order_id')::uuid;
  v_total := round((v_result->>'total')::numeric, 2);
  v_order_number := COALESCE(v_result->>'order_number', v_order_id::text);

  IF abs(round(v_payment_total, 2) - v_total) > 0.05 THEN
    RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
      v_payment_total, v_total;
  END IF;

  v_idx := 0;
  v_others := 0;
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_idx := v_idx + 1;
    v_amount := round(COALESCE((v_payment->>'amount')::numeric, 0), 2);
    IF v_idx < v_payment_count THEN
      v_others := v_others + v_amount;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_amount)
      );
    ELSE
      v_last_amount := round(v_total - v_others, 2);
      IF v_last_amount <= 0 THEN
        RAISE EXCEPTION 'Split payments must equal order total (payments=%, order=%)',
          v_payment_total, v_total;
      END IF;
      v_adjusted_payments := v_adjusted_payments || jsonb_build_array(
        jsonb_build_object('method', v_payment->>'method', 'amount', v_last_amount)
      );
    END IF;
  END LOOP;

  DELETE FROM order_payments WHERE order_id = v_order_id;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_adjusted_payments)
  LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (
      v_order_id,
      (v_payment->>'method')::payment_method,
      round((v_payment->>'amount')::numeric, 2)
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_credit_amount
  FROM order_payments
  WHERE order_id = v_order_id AND method = 'credit';

  IF v_credit_amount > 0 AND v_payment_count > 1 THEN
    SELECT account_balance, credit_limit INTO v_customer_balance, v_customer_limit
    FROM customers WHERE id = p_customer_id AND org_id = v_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    IF v_customer_limit > 0 AND (v_customer_balance + v_credit_amount) > v_customer_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    INSERT INTO customer_ledger (
      org_id, store_id, customer_id, entry_type, debit, credit, order_id, reference, created_by
    ) VALUES (
      v_org_id, p_store_id, p_customer_id, 'credit_sale', v_credit_amount, 0, v_order_id, v_order_number, p_cashier_id
    );

    UPDATE customers
    SET account_balance = account_balance + v_credit_amount
    WHERE id = p_customer_id AND org_id = v_org_id;

    v_payment_status := 'partial';
  ELSIF v_credit_amount > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  UPDATE orders
  SET payment_status = v_payment_status
  WHERE id = v_order_id;

  RETURN v_result || jsonb_build_object(
    'payment_status', v_payment_status,
    'credit_amount', v_credit_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_checkout_split_expired_override(
  UUID, UUID, UUID, UUID, payment_method, NUMERIC, JSONB, JSONB, UUID, sales_mode
) TO authenticated;
