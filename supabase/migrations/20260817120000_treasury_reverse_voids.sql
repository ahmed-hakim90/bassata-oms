-- Reverse HQ/store treasury cash when a supplier payment is voided,
-- a cash expense is deleted, or a customer collection is voided.
-- Append-only: posts the opposite signed amount on the original entry_type.
-- Idempotent: net zero for that source means nothing to reverse.
-- treasury_apply_delta stays revoked from authenticated.

CREATE OR REPLACE FUNCTION treasury_reverse_supplier_pay(p_supplier_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_net NUMERIC;
  v_treasury_id UUID;
  v_row cash_treasuries;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_net
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND supplier_payment_id = p_supplier_payment_id
    AND entry_type = 'supplier_payout';

  IF v_net = 0 THEN
    RETURN NULL;
  END IF;

  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT treasury_id INTO v_treasury_id
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND supplier_payment_id = p_supplier_payment_id
    AND entry_type = 'supplier_payout'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = v_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  PERFORM treasury_apply_delta(
    v_row.id, 'supplier_payout', -v_net, NULL,
    'عكس سداد مورد ملغي',
    NULL, NULL, NULL, p_supplier_payment_id, NULL
  );

  UPDATE supplier_payments
  SET treasury_id = NULL
  WHERE id = p_supplier_payment_id AND org_id = v_org_id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION treasury_reverse_expense(p_expense_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_net NUMERIC;
  v_treasury_id UUID;
  v_row cash_treasuries;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_net
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND expense_id = p_expense_id
    AND entry_type = 'expense_payout';

  IF v_net = 0 THEN
    RETURN NULL;
  END IF;

  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT treasury_id INTO v_treasury_id
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND expense_id = p_expense_id
    AND entry_type = 'expense_payout'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = v_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  PERFORM treasury_apply_delta(
    v_row.id, 'expense_payout', -v_net, NULL,
    'عكس مصروف محذوف',
    NULL, p_expense_id, NULL, NULL, NULL
  );

  UPDATE expenses e
  SET treasury_id = NULL
  FROM stores s
  WHERE e.id = p_expense_id
    AND e.store_id = s.id
    AND s.org_id = v_org_id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION treasury_reverse_collection(p_customer_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_net NUMERIC;
  v_treasury_id UUID;
  v_row cash_treasuries;
BEGIN
  v_org_id := auth_org_id();
  IF v_org_id IS NULL OR auth_app_user_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_net
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND customer_payment_id = p_customer_payment_id
    AND entry_type = 'collection_deposit';

  IF v_net = 0 THEN
    RETURN NULL;
  END IF;

  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT treasury_id INTO v_treasury_id
  FROM cash_treasury_ledger
  WHERE org_id = v_org_id
    AND customer_payment_id = p_customer_payment_id
    AND entry_type = 'collection_deposit'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT * INTO v_row FROM cash_treasuries WHERE id = v_treasury_id AND org_id = v_org_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Treasury not found';
  END IF;
  PERFORM assert_treasury_access(v_row);

  PERFORM treasury_apply_delta(
    v_row.id, 'collection_deposit', -v_net, NULL,
    'عكس تحصيل عميل ملغي',
    NULL, NULL, p_customer_payment_id, NULL, NULL
  );

  UPDATE customer_payments
  SET treasury_id = NULL
  WHERE id = p_customer_payment_id AND org_id = v_org_id;

  RETURN v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION treasury_reverse_supplier_pay(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION treasury_reverse_expense(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION treasury_reverse_collection(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION treasury_reverse_supplier_pay(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_reverse_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_reverse_collection(UUID) TO authenticated;
