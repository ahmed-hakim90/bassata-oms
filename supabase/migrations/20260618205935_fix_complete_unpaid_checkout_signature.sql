-- Disambiguate complete_unpaid_checkout after complete_checkout gained
-- optional device and sales mode parameters.
CREATE OR REPLACE FUNCTION complete_unpaid_checkout(
  p_store_id UUID,
  p_session_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_discount NUMERIC,
  p_lines JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_order_id UUID;
BEGIN
  v_result := complete_checkout(
    p_store_id,
    p_session_id,
    p_cashier_id,
    p_customer_id,
    'cash'::payment_method,
    p_discount,
    p_lines,
    NULL::uuid,
    'retail'::sales_mode
  );
  v_order_id := (v_result->>'order_id')::uuid;

  DELETE FROM order_payments WHERE order_id = v_order_id;
  UPDATE orders SET payment_status = 'unpaid' WHERE id = v_order_id;

  PERFORM insert_audit_log('order.created_unpaid', 'order', v_order_id::text, p_store_id, v_result);
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_unpaid_checkout(UUID, UUID, UUID, UUID, NUMERIC, JSONB)
  TO authenticated;
