-- Reservation and status must commit together; otherwise a failed status write
-- can leave stock held (or released) under the wrong order state.
CREATE OR REPLACE FUNCTION public.transition_online_order_status_atomic(
  p_online_order_id UUID,
  p_status online_order_status,
  p_actor_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order public.online_orders%ROWTYPE;
  v_allowed BOOLEAN := false;
BEGIN
  IF auth_app_user_id() IS NULL OR NOT has_permission('checkout_create') THEN
    RAISE EXCEPTION 'Checkout permission required';
  END IF;
  IF p_actor_id IS DISTINCT FROM auth_app_user_id()
     AND auth_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  SELECT * INTO v_order
  FROM online_orders
  WHERE id = p_online_order_id
  FOR UPDATE;
  IF v_order.id IS NULL OR NOT has_store_access(v_order.store_id) THEN
    RAISE EXCEPTION 'Online order not found';
  END IF;
  IF v_order.status = 'invoiced' OR (v_order.status = 'cancelled' AND p_status <> 'cancelled') THEN
    RAISE EXCEPTION 'Online order status cannot be changed';
  END IF;

  v_allowed := v_order.status = p_status OR CASE v_order.status
    WHEN 'pending' THEN p_status IN ('accepted', 'preparing', 'ready', 'cancelled')
    WHEN 'accepted' THEN p_status IN ('preparing', 'ready', 'cancelled')
    WHEN 'preparing' THEN p_status IN ('ready', 'cancelled')
    WHEN 'ready' THEN p_status = 'cancelled'
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Online order status transition is not allowed'; END IF;
  IF v_order.status = p_status THEN RETURN to_jsonb(v_order); END IF;

  IF v_order.status = 'pending' AND p_status IN ('accepted', 'preparing', 'ready') THEN
    PERFORM set_online_order_reservation(p_online_order_id, true, p_actor_id);
  ELSIF p_status = 'cancelled' THEN
    PERFORM set_online_order_reservation(p_online_order_id, false, p_actor_id);
  END IF;

  UPDATE online_orders SET status = p_status
  WHERE id = p_online_order_id
  RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_online_order_status_atomic(
  UUID, online_order_status, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_online_order_status_atomic(
  UUID, online_order_status, UUID
) TO authenticated;
