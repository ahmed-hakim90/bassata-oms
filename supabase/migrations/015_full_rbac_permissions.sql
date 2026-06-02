-- Full system RBAC permissions (extends 011 accounting permissions)

INSERT INTO permissions (key, label, description, group_name) VALUES
  ('pos_access', 'POS access', 'Open and use the POS screen', 'pos'),
  ('checkout_create', 'Checkout', 'Complete POS checkout', 'pos'),
  ('order_view', 'View orders', 'View order history and details', 'orders'),
  ('order_void', 'Void orders', 'Void completed orders', 'orders'),
  ('order_refund', 'Refund orders', 'Refund orders', 'orders'),
  ('online_order_manage', 'Online orders', 'Manage QR online orders', 'orders'),
  ('product_manage', 'Manage products', 'Create and edit products and categories', 'products'),
  ('recipe_manage', 'Manage recipes', 'Edit product recipes and costing', 'products'),
  ('inventory_view', 'View inventory', 'View stock levels and movements', 'inventory'),
  ('purchase_manage', 'Manage purchases', 'Create and receive purchase invoices', 'inventory'),
  ('transfer_manage', 'Manage transfers', 'Create and process stock transfers', 'inventory'),
  ('waste_manage', 'Record waste', 'Record inventory waste', 'inventory'),
  ('stock_count_manage', 'Stock count', 'Run stock counts', 'inventory'),
  ('session_open', 'Open session', 'Open cashier sessions', 'sessions'),
  ('session_close', 'Close session', 'Close cashier sessions', 'sessions'),
  ('session_view', 'View sessions', 'View session history', 'sessions'),
  ('customer_manage', 'Manage customers', 'Create and edit customers', 'customers'),
  ('loyalty_manage', 'Manage loyalty', 'Configure and redeem loyalty', 'customers'),
  ('reports_view', 'View reports', 'Access reports dashboard', 'reports'),
  ('costs_view', 'View costs', 'View COGS, margins, and profit data', 'reports'),
  ('settings_manage', 'Manage settings', 'Edit organization and app settings', 'system'),
  ('user_manage', 'Manage users', 'Create and edit users', 'system'),
  ('audit_view', 'View audit logs', 'Access audit log history', 'system'),
  ('imports_exports', 'Imports & exports', 'Import and export data', 'system'),
  ('monthly_closing_manage', 'Monthly closing', 'Generate and close monthly periods', 'system'),
  ('monthly_closing_reopen', 'Reopen periods', 'Reopen closed accounting periods', 'system')
ON CONFLICT (key) DO NOTHING;

-- Seed role_permissions for existing orgs (merge with 011 expense permissions)
DO $$
DECLARE
  r_org RECORD;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    -- Owner: all permissions
    INSERT INTO role_permissions (org_id, role, permission_key)
    SELECT r_org.id, 'owner', key FROM permissions
    ON CONFLICT DO NOTHING;

    -- Manager: all except reopen and user_manage (partial - no user create/deactivate)
    INSERT INTO role_permissions (org_id, role, permission_key)
    SELECT r_org.id, 'manager', key FROM permissions
    WHERE key NOT IN ('monthly_closing_reopen', 'user_manage')
    ON CONFLICT DO NOTHING;

    -- Cashier
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'cashier', 'pos_access'),
      (r_org.id, 'cashier', 'checkout_create'),
      (r_org.id, 'cashier', 'order_view'),
      (r_org.id, 'cashier', 'session_open'),
      (r_org.id, 'cashier', 'session_close'),
      (r_org.id, 'cashier', 'session_view'),
      (r_org.id, 'cashier', 'session_expense_create'),
      (r_org.id, 'cashier', 'purchase_from_session_create')
    ON CONFLICT DO NOTHING;

    -- Inventory role
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'inventory', 'product_manage'),
      (r_org.id, 'inventory', 'recipe_manage'),
      (r_org.id, 'inventory', 'inventory_view'),
      (r_org.id, 'inventory', 'purchase_manage'),
      (r_org.id, 'inventory', 'transfer_manage'),
      (r_org.id, 'inventory', 'waste_manage'),
      (r_org.id, 'inventory', 'stock_count_manage')
    ON CONFLICT DO NOTHING;

    -- Viewer
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'viewer', 'order_view'),
      (r_org.id, 'viewer', 'reports_view'),
      (r_org.id, 'viewer', 'expense_view_all')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
