-- Restore default POS/ops role permissions that were missing on live orgs.
INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, 'manager'::user_role, p.key
FROM organizations o
CROSS JOIN permissions p
WHERE p.key NOT IN ('monthly_closing_reopen', 'user_manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (org_id, role, permission_key)
SELECT o.id, x.role::user_role, x.permission_key
FROM organizations o
CROSS JOIN (
  VALUES
    ('cashier', 'pos_access'),
    ('cashier', 'checkout_create'),
    ('cashier', 'order_view'),
    ('cashier', 'session_open'),
    ('cashier', 'session_close'),
    ('cashier', 'session_view'),
    ('cashier', 'session_expense_create'),
    ('cashier', 'purchase_from_session_create'),
    ('cashier', 'customer_payment_receive'),
    ('cashier', 'customer_manage'),
    ('inventory', 'product_manage'),
    ('inventory', 'recipe_manage'),
    ('inventory', 'inventory_view'),
    ('inventory', 'purchase_manage'),
    ('inventory', 'transfer_manage'),
    ('inventory', 'waste_manage'),
    ('inventory', 'stock_count_manage')
) AS x(role, permission_key)
ON CONFLICT DO NOTHING;
