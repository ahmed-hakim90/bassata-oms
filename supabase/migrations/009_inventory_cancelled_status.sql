-- Cancelled status for transfers/purchases; allow inventory role to delete drafts.

ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'cancelled';

DROP POLICY IF EXISTS transfers_delete ON transfer_orders;
CREATE POLICY transfers_delete ON transfer_orders FOR DELETE
  USING (
    has_store_access(from_store_id)
    AND has_store_access(to_store_id)
    AND (
      is_privileged_role()
      OR (status = 'draft' AND can_mutate_inventory_ops())
    )
  );

DROP POLICY IF EXISTS purchases_delete ON purchase_invoices;
CREATE POLICY purchases_delete ON purchase_invoices FOR DELETE
  USING (
    has_store_access(store_id)
    AND (
      is_privileged_role()
      OR (status = 'draft' AND can_mutate_inventory_ops())
    )
  );
