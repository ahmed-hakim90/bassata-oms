-- Feature-flag enforcement on sensitive writes + role-scoped RLS for store tables

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_mutate_orders() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR auth_user_role() = 'cashier';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_mutate_expenses() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR auth_user_role() = 'cashier';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_mutate_inventory_ops() RETURNS BOOLEAN AS $$
  SELECT is_privileged_role()
    OR auth_user_role() = 'inventory'::user_role;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION require_feature(p_flag TEXT) RETURNS VOID AS $$
BEGIN
  IF NOT is_feature_enabled(p_flag) THEN
    RAISE EXCEPTION 'Feature disabled: %', p_flag;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expenses: session_expenses flag
CREATE OR REPLACE FUNCTION trg_expenses_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('session_expenses');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_require_feature ON expenses;
CREATE TRIGGER expenses_require_feature
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION trg_expenses_require_feature();

-- Orders: refunds when status becomes refunded
CREATE OR REPLACE FUNCTION trg_orders_refund_feature() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'refunded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM require_feature('refunds');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_refund_feature ON orders;
CREATE TRIGGER orders_refund_feature
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_refund_feature();

CREATE OR REPLACE FUNCTION trg_purchases_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('purchases');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchases_require_feature ON purchase_invoices;
CREATE TRIGGER purchases_require_feature
  BEFORE INSERT OR UPDATE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION trg_purchases_require_feature();

CREATE OR REPLACE FUNCTION trg_transfers_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('transfers');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transfers_require_feature ON transfer_orders;
CREATE TRIGGER transfers_require_feature
  BEFORE INSERT OR UPDATE ON transfer_orders
  FOR EACH ROW EXECUTE FUNCTION trg_transfers_require_feature();

CREATE OR REPLACE FUNCTION trg_waste_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('waste');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waste_require_feature ON waste_records;
CREATE TRIGGER waste_require_feature
  BEFORE INSERT OR UPDATE ON waste_records
  FOR EACH ROW EXECUTE FUNCTION trg_waste_require_feature();

CREATE OR REPLACE FUNCTION trg_stock_count_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('stock_count');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_count_require_feature ON stock_counts;
CREATE TRIGGER stock_count_require_feature
  BEFORE INSERT OR UPDATE ON stock_counts
  FOR EACH ROW EXECUTE FUNCTION trg_stock_count_require_feature();

CREATE OR REPLACE FUNCTION trg_monthly_closing_require_feature() RETURNS TRIGGER AS $$
BEGIN
  PERFORM require_feature('monthly_closing');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monthly_closing_require_feature ON monthly_closes;
CREATE TRIGGER monthly_closing_require_feature
  BEFORE INSERT OR UPDATE ON monthly_closes
  FOR EACH ROW EXECUTE FUNCTION trg_monthly_closing_require_feature();

-- Role-scoped RLS: viewer read-only on store operational tables
DROP POLICY IF EXISTS orders_store ON orders;
CREATE POLICY orders_select ON orders FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_orders())
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());
CREATE POLICY orders_delete ON orders FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS expenses_store ON expenses;
CREATE POLICY expenses_select ON expenses FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY expenses_insert ON expenses FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_expenses());
CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_expenses())
  WITH CHECK (has_store_access(store_id) AND can_mutate_expenses());
CREATE POLICY expenses_delete ON expenses FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS sessions_store ON cashier_sessions;
CREATE POLICY sessions_select ON cashier_sessions FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY sessions_insert ON cashier_sessions FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());
CREATE POLICY sessions_update ON cashier_sessions FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_orders())
  WITH CHECK (has_store_access(store_id) AND can_mutate_orders());
CREATE POLICY sessions_delete ON cashier_sessions FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS devices_access ON devices;
CREATE POLICY devices_select ON devices FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY devices_mutate ON devices FOR ALL
  USING (has_store_access(store_id) AND is_privileged_role())
  WITH CHECK (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS purchases_store ON purchase_invoices;
CREATE POLICY purchases_select ON purchase_invoices FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY purchases_mutate ON purchase_invoices FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY purchases_update ON purchase_invoices FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_inventory_ops())
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY purchases_delete ON purchase_invoices FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS waste_store ON waste_records;
CREATE POLICY waste_select ON waste_records FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY waste_mutate ON waste_records FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY waste_update ON waste_records FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_inventory_ops())
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY waste_delete ON waste_records FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS stock_counts_store ON stock_counts;
CREATE POLICY stock_counts_select ON stock_counts FOR SELECT
  USING (has_store_access(store_id));
CREATE POLICY stock_counts_mutate ON stock_counts FOR INSERT
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY stock_counts_update ON stock_counts FOR UPDATE
  USING (has_store_access(store_id) AND can_mutate_inventory_ops())
  WITH CHECK (has_store_access(store_id) AND can_mutate_inventory_ops());
CREATE POLICY stock_counts_delete ON stock_counts FOR DELETE
  USING (has_store_access(store_id) AND is_privileged_role());

DROP POLICY IF EXISTS transfers_store ON transfer_orders;
CREATE POLICY transfers_select ON transfer_orders FOR SELECT
  USING (has_store_access(from_store_id) AND has_store_access(to_store_id));
CREATE POLICY transfers_mutate ON transfer_orders FOR INSERT
  WITH CHECK (
    has_store_access(from_store_id) AND has_store_access(to_store_id)
    AND can_mutate_inventory_ops()
  );
CREATE POLICY transfers_update ON transfer_orders FOR UPDATE
  USING (
    has_store_access(from_store_id) AND has_store_access(to_store_id)
    AND can_mutate_inventory_ops()
  )
  WITH CHECK (
    has_store_access(from_store_id) AND has_store_access(to_store_id)
    AND can_mutate_inventory_ops()
  );
CREATE POLICY transfers_delete ON transfer_orders FOR DELETE
  USING (
    has_store_access(from_store_id) AND has_store_access(to_store_id)
    AND is_privileged_role()
  );

GRANT EXECUTE ON FUNCTION require_feature TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_role TO authenticated;
