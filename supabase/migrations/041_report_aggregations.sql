-- Server-side report aggregations for performance
-- Scoped via stores.org_id (orders/stock_levels have no org_id column)

CREATE OR REPLACE FUNCTION report_sales_summary(
  p_store_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS TABLE (
  total_revenue NUMERIC,
  order_count BIGINT,
  avg_order_value NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(o.total), 0)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS order_count,
    CASE WHEN COUNT(*) > 0 THEN (SUM(o.total) / COUNT(*))::NUMERIC ELSE 0 END AS avg_order_value
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.status = 'completed'
    AND s.org_id = (SELECT org_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
    AND (p_store_id IS NULL OR o.store_id = p_store_id)
    AND (p_from IS NULL OR o.created_at >= p_from)
    AND (p_to IS NULL OR o.created_at <= p_to)
    AND (
      p_payment_method IS NULL
      OR EXISTS (
        SELECT 1 FROM order_payments op
        WHERE op.order_id = o.id AND op.method::TEXT = p_payment_method
      )
    );
$$;

CREATE OR REPLACE FUNCTION report_sales_by_day(
  p_store_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  day DATE,
  revenue NUMERIC,
  order_count BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (o.created_at AT TIME ZONE 'UTC')::DATE AS day,
    COALESCE(SUM(o.total), 0)::NUMERIC AS revenue,
    COUNT(*)::BIGINT AS order_count
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.status = 'completed'
    AND s.org_id = (SELECT org_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
    AND (p_store_id IS NULL OR o.store_id = p_store_id)
    AND (p_from IS NULL OR o.created_at >= p_from)
    AND (p_to IS NULL OR o.created_at <= p_to)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION report_session_reconciliation(p_session_id UUID)
RETURNS TABLE (
  opening_cash NUMERIC,
  cash_sales NUMERIC,
  card_sales NUMERIC,
  wallet_sales NUMERIC,
  credit_sales NUMERIC,
  cash_refunds NUMERIC,
  expenses NUMERIC,
  customer_payments NUMERIC,
  expected_cash NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session cashier_sessions%ROWTYPE;
  v_cash_sales NUMERIC := 0;
  v_card_sales NUMERIC := 0;
  v_wallet_sales NUMERIC := 0;
  v_credit_sales NUMERIC := 0;
  v_cash_refunds NUMERIC := 0;
  v_expenses NUMERIC := 0;
BEGIN
  SELECT * INTO v_session FROM cashier_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN op.method = 'cash' THEN op.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN op.method = 'card' THEN op.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN op.method = 'wallet' THEN op.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN op.method = 'credit' THEN op.amount ELSE 0 END), 0)
  INTO v_cash_sales, v_card_sales, v_wallet_sales, v_credit_sales
  FROM orders o
  JOIN order_payments op ON op.order_id = o.id
  WHERE o.session_id = p_session_id AND o.status = 'completed';

  SELECT COALESCE(SUM(op.amount), 0) INTO v_cash_refunds
  FROM orders o
  JOIN order_payments op ON op.order_id = o.id
  WHERE o.session_id = p_session_id
    AND o.status IN ('voided', 'refunded')
    AND op.method = 'cash';

  SELECT COALESCE(SUM(e.amount), 0) INTO v_expenses
  FROM expenses e
  WHERE e.session_id = p_session_id
    AND e.expense_source = 'session_cash'
    AND e.payment_method = 'cash'
    AND e.status = 'approved';

  RETURN QUERY SELECT
    v_session.opening_cash,
    v_cash_sales,
    v_card_sales,
    v_wallet_sales,
    v_credit_sales,
    v_cash_refunds,
    v_expenses,
    0::NUMERIC,
    (v_session.opening_cash + v_cash_sales - v_cash_refunds - v_expenses)::NUMERIC;
END;
$$;

CREATE OR REPLACE FUNCTION report_inventory_valuation(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  quantity NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sl.product_id,
    p.name AS product_name,
    COALESCE(SUM(sl.quantity), 0)::NUMERIC AS quantity,
    COALESCE(p.last_unit_cost, 0)::NUMERIC AS unit_cost,
    (COALESCE(SUM(sl.quantity), 0) * COALESCE(p.last_unit_cost, 0))::NUMERIC AS total_value
  FROM stock_levels sl
  JOIN products p ON p.id = sl.product_id
  JOIN stores s ON s.id = sl.store_id
  WHERE s.org_id = (SELECT org_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
    AND (p_store_id IS NULL OR sl.store_id = p_store_id)
  GROUP BY sl.product_id, p.name, p.last_unit_cost
  HAVING COALESCE(SUM(sl.quantity), 0) > 0
  ORDER BY total_value DESC;
$$;

CREATE OR REPLACE FUNCTION report_expiry_batches(
  p_store_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'all'
) RETURNS TABLE (
  batch_id UUID,
  product_name TEXT,
  batch_number TEXT,
  expiry_date DATE,
  remaining_quantity NUMERIC,
  days_until_expiry INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.id AS batch_id,
    p.name AS product_name,
    b.batch_number,
    b.expiry_date::DATE,
    b.remaining_quantity::NUMERIC,
    (b.expiry_date::DATE - CURRENT_DATE)::INT AS days_until_expiry
  FROM inventory_batches b
  JOIN products p ON p.id = b.product_id
  JOIN warehouses w ON w.id = b.warehouse_id
  WHERE b.org_id = (SELECT org_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
    AND b.remaining_quantity > 0
    AND b.expiry_date IS NOT NULL
    AND (p_store_id IS NULL OR w.store_id = p_store_id)
    AND (
      p_status = 'all'
      OR (p_status = 'expired' AND b.expiry_date::DATE < CURRENT_DATE)
      OR (p_status = 'near' AND b.expiry_date::DATE BETWEEN CURRENT_DATE AND CURRENT_DATE + 14)
    )
  ORDER BY b.expiry_date ASC;
$$;

GRANT EXECUTE ON FUNCTION report_sales_summary TO authenticated;
GRANT EXECUTE ON FUNCTION report_sales_by_day TO authenticated;
GRANT EXECUTE ON FUNCTION report_session_reconciliation TO authenticated;
GRANT EXECUTE ON FUNCTION report_inventory_valuation TO authenticated;
GRANT EXECUTE ON FUNCTION report_expiry_batches TO authenticated;
