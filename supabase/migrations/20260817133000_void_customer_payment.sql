-- Void a customer collection: mark payment, reverse AR ledger + balance,
-- and reverse treasury cash in the same transaction.
-- customer_payments has no UPDATE policy for authenticated; this RPC is the write path.

CREATE OR REPLACE FUNCTION void_customer_payment(p_payment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_app_user UUID;
  v_payment customer_payments;
  v_balance NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_app_user := auth_user_id();
  IF v_org_id IS NULL OR v_app_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_payment
  FROM customer_payments
  WHERE id = p_payment_id AND org_id = v_org_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'تحصيل العميل غير موجود';
  END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'التحصيل ملغي';
  END IF;
  IF NOT has_store_access(v_payment.store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(v_payment.store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  UPDATE customer_payments
  SET voided_at = now()
  WHERE id = v_payment.id AND org_id = v_org_id AND voided_at IS NULL;

  INSERT INTO customer_ledger (
    org_id, store_id, customer_id, entry_type, debit, credit, payment_id, reference, notes, created_by
  ) VALUES (
    v_org_id, v_payment.store_id, v_payment.customer_id, 'adjustment', v_payment.amount, 0,
    v_payment.id, v_payment.reference, 'عكس تحصيل ملغي', v_app_user
  );

  UPDATE customers
  SET account_balance = account_balance + v_payment.amount
  WHERE id = v_payment.customer_id AND org_id = v_org_id
  RETURNING account_balance INTO v_balance;

  PERFORM treasury_reverse_collection(v_payment.id);

  PERFORM insert_audit_log(
    'customer.payment_voided', 'customer_payment', v_payment.id::text, v_payment.store_id,
    jsonb_build_object(
      'customer_id', v_payment.customer_id,
      'amount', v_payment.amount,
      'balance', v_balance
    )
  );

  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION void_customer_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION void_customer_payment(UUID) TO authenticated;
