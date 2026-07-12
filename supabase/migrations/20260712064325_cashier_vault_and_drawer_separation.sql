-- Cashier vault (خزينة) separate from session drawer (درج).
-- Vault is org + store + cashier scoped amanah; drawer expected cash stays session-only.

CREATE TYPE cashier_vault_entry_type AS ENUM (
  'session_close_deposit',
  'session_open_float',
  'admin_withdraw'
);

CREATE TABLE IF NOT EXISTS cashier_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  pending_opening_float NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_opening_float >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, store_id, cashier_id)
);

CREATE INDEX IF NOT EXISTS idx_cashier_vaults_store
  ON cashier_vaults(store_id, cashier_id);

CREATE TABLE IF NOT EXISTS cashier_vault_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES cashier_vaults(id) ON DELETE CASCADE,
  entry_type cashier_vault_entry_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  session_id UUID REFERENCES cashier_sessions(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashier_vault_ledger_vault
  ON cashier_vault_ledger(vault_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_vault_ledger_cashier
  ON cashier_vault_ledger(store_id, cashier_id, created_at DESC);

ALTER TABLE cashier_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_vault_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashier_vaults_select ON cashier_vaults;
CREATE POLICY cashier_vaults_select ON cashier_vaults FOR SELECT
  USING (
    org_id = auth_org_id()
    AND has_store_access(store_id)
    AND (
      is_privileged_role()
      OR cashier_id = auth_app_user_id()
    )
  );

DROP POLICY IF EXISTS cashier_vault_ledger_select ON cashier_vault_ledger;
CREATE POLICY cashier_vault_ledger_select ON cashier_vault_ledger FOR SELECT
  USING (
    org_id = auth_org_id()
    AND has_store_access(store_id)
    AND (
      is_privileged_role()
      OR cashier_id = auth_app_user_id()
    )
  );

-- Mutations only via SECURITY DEFINER RPCs below (no direct INSERT/UPDATE policies).

CREATE OR REPLACE FUNCTION ensure_cashier_vault(
  p_org_id UUID,
  p_store_id UUID,
  p_cashier_id UUID
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault cashier_vaults;
BEGIN
  INSERT INTO cashier_vaults (org_id, store_id, cashier_id)
  VALUES (p_org_id, p_store_id, p_cashier_id)
  ON CONFLICT (org_id, store_id, cashier_id) DO UPDATE
    SET updated_at = cashier_vaults.updated_at
  RETURNING * INTO v_vault;

  IF v_vault.id IS NULL THEN
    SELECT * INTO v_vault
    FROM cashier_vaults
    WHERE org_id = p_org_id AND store_id = p_store_id AND cashier_id = p_cashier_id;
  END IF;

  RETURN v_vault;
END;
$$;

CREATE OR REPLACE FUNCTION cashier_vault_take_opening_float(
  p_store_id UUID,
  p_cashier_id UUID,
  p_amount NUMERIC
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_vault cashier_vaults;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(p_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Opening float must be zero or positive';
  END IF;

  v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE id = v_vault.id
  FOR UPDATE;

  IF v_vault.balance < v_amount THEN
    RAISE EXCEPTION 'رصيد الخزينة غير كافٍ لرصيد بداية الوردية';
  END IF;

  UPDATE cashier_vaults
  SET
    balance = balance - v_amount,
    pending_opening_float = 0,
    updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  IF v_amount > 0 THEN
    INSERT INTO cashier_vault_ledger (
      org_id, store_id, cashier_id, vault_id, entry_type,
      amount, balance_after, notes, created_by
    ) VALUES (
      v_org_id, p_store_id, p_cashier_id, v_vault.id, 'session_open_float',
      -v_amount, v_vault.balance, 'تحويل رصيد بداية الوردية للدرج', v_user_id
    );
  END IF;

  PERFORM insert_audit_log(
    'cashier_vault.open_float',
    'cashier_vault',
    v_vault.id::text,
    p_store_id,
    jsonb_build_object(
      'cashier_id', p_cashier_id,
      'amount', v_amount,
      'balance_after', v_vault.balance
    )
  );

  RETURN v_vault;
END;
$$;

CREATE OR REPLACE FUNCTION cashier_vault_deposit_closing(
  p_store_id UUID,
  p_cashier_id UUID,
  p_amount NUMERIC,
  p_session_id UUID
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_vault cashier_vaults;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Closing deposit must be zero or positive';
  END IF;

  -- Idempotent if this session already deposited.
  IF p_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM cashier_vault_ledger
    WHERE session_id = p_session_id
      AND entry_type = 'session_close_deposit'
  ) THEN
    SELECT * INTO v_vault
    FROM cashier_vaults
    WHERE org_id = v_org_id AND store_id = p_store_id AND cashier_id = p_cashier_id;
    RETURN v_vault;
  END IF;

  v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE id = v_vault.id
  FOR UPDATE;

  UPDATE cashier_vaults
  SET
    balance = balance + v_amount,
    updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  IF v_amount > 0 OR p_session_id IS NOT NULL THEN
    INSERT INTO cashier_vault_ledger (
      org_id, store_id, cashier_id, vault_id, entry_type,
      amount, balance_after, session_id, notes, created_by
    ) VALUES (
      v_org_id, p_store_id, p_cashier_id, v_vault.id, 'session_close_deposit',
      v_amount, v_vault.balance, p_session_id, 'تسليم عدّ الدرج للخزينة', v_user_id
    );
  END IF;

  PERFORM insert_audit_log(
    'cashier_vault.close_deposit',
    'cashier_vault',
    v_vault.id::text,
    p_store_id,
    jsonb_build_object(
      'cashier_id', p_cashier_id,
      'session_id', p_session_id,
      'amount', v_amount,
      'balance_after', v_vault.balance
    )
  );

  RETURN v_vault;
END;
$$;

CREATE OR REPLACE FUNCTION cashier_vault_admin_withdraw(
  p_store_id UUID,
  p_cashier_id UUID,
  p_withdraw_amount NUMERIC,
  p_next_opening_float NUMERIC,
  p_notes TEXT DEFAULT ''
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_vault cashier_vaults;
  v_withdraw NUMERIC;
  v_next NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT is_privileged_role() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;
  IF is_period_closed(p_store_id, now()) THEN
    RAISE EXCEPTION 'Period is closed for this date';
  END IF;

  v_withdraw := COALESCE(p_withdraw_amount, 0);
  v_next := COALESCE(p_next_opening_float, 0);
  IF v_withdraw < 0 OR v_next < 0 THEN
    RAISE EXCEPTION 'المبالغ يجب تكون صفر أو أكبر';
  END IF;

  v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE id = v_vault.id
  FOR UPDATE;

  IF v_withdraw + v_next > v_vault.balance THEN
    RAISE EXCEPTION 'السحب + رصيد بداية الوردية الجاية أكبر من رصيد الخزينة';
  END IF;

  UPDATE cashier_vaults
  SET
    balance = balance - v_withdraw,
    pending_opening_float = v_next,
    updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  INSERT INTO cashier_vault_ledger (
    org_id, store_id, cashier_id, vault_id, entry_type,
    amount, balance_after, notes, created_by
  ) VALUES (
    v_org_id, p_store_id, p_cashier_id, v_vault.id, 'admin_withdraw',
    -v_withdraw, v_vault.balance,
    COALESCE(NULLIF(trim(p_notes), ''), 'سحب إداري من خزينة الكاشير'),
    v_user_id
  );

  PERFORM insert_audit_log(
    'cashier_vault.admin_withdraw',
    'cashier_vault',
    v_vault.id::text,
    p_store_id,
    jsonb_build_object(
      'cashier_id', p_cashier_id,
      'withdraw_amount', v_withdraw,
      'next_opening_float', v_next,
      'balance_after', v_vault.balance,
      'notes', COALESCE(p_notes, '')
    )
  );

  RETURN v_vault;
END;
$$;

CREATE OR REPLACE FUNCTION cashier_vault_refund_opening_float(
  p_store_id UUID,
  p_cashier_id UUID,
  p_amount NUMERIC
) RETURNS cashier_vaults
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_vault cashier_vaults;
  v_amount NUMERIC;
BEGIN
  v_org_id := auth_org_id();
  v_user_id := auth_app_user_id();
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT has_store_access(p_store_id) THEN
    RAISE EXCEPTION 'Store access denied';
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount <= 0 THEN
    v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);
    RETURN v_vault;
  END IF;

  v_vault := ensure_cashier_vault(v_org_id, p_store_id, p_cashier_id);

  SELECT * INTO v_vault
  FROM cashier_vaults
  WHERE id = v_vault.id
  FOR UPDATE;

  UPDATE cashier_vaults
  SET
    balance = balance + v_amount,
    updated_at = now()
  WHERE id = v_vault.id
  RETURNING * INTO v_vault;

  INSERT INTO cashier_vault_ledger (
    org_id, store_id, cashier_id, vault_id, entry_type,
    amount, balance_after, notes, created_by
  ) VALUES (
    v_org_id, p_store_id, p_cashier_id, v_vault.id, 'session_open_float',
    v_amount, v_vault.balance, 'استرجاع رصيد بداية الوردية بعد فشل فتح الجلسة', v_user_id
  );

  RETURN v_vault;
END;
$$;

-- ensure_cashier_vault is internal — only other SECURITY DEFINER helpers call it.
REVOKE ALL ON FUNCTION ensure_cashier_vault(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cashier_vault_take_opening_float(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION cashier_vault_deposit_closing(UUID, UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cashier_vault_admin_withdraw(UUID, UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cashier_vault_refund_opening_float(UUID, UUID, NUMERIC) TO authenticated;
