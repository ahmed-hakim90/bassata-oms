-- Reporting, print, PDF, Excel, and barcode label permissions

INSERT INTO permissions (key, label, description, group_name) VALUES
  ('reports_print', 'Print reports', 'Open printable report layouts', 'reports'),
  ('reports_export_excel', 'Export Excel', 'Export reports and data to XLSX', 'reports'),
  ('reports_export_pdf', 'Export PDF', 'Download reports as PDF', 'reports'),
  ('financial_reports_view', 'Financial reports', 'View revenue, COGS, and expense reports', 'reports'),
  ('profit_reports_view', 'Profit reports', 'View gross and net profit margins', 'reports'),
  ('customer_statement_view', 'Customer statements', 'View customer account statements', 'reports'),
  ('supplier_statement_view', 'Supplier statements', 'View supplier account statements', 'reports'),
  ('barcode_label_print', 'Barcode labels', 'Print product barcode labels', 'reports')
ON CONFLICT (key) DO NOTHING;

-- Seed role_permissions for existing orgs
DO $$
DECLARE
  r_org RECORD;
BEGIN
  FOR r_org IN SELECT id FROM organizations LOOP
    -- Owner gets all via existing seed; ensure new keys are present
    INSERT INTO role_permissions (org_id, role, permission_key)
    SELECT r_org.id, 'owner', key FROM permissions
    ON CONFLICT DO NOTHING;

    -- Manager: all reporting permissions
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'manager', 'reports_print'),
      (r_org.id, 'manager', 'reports_export_excel'),
      (r_org.id, 'manager', 'reports_export_pdf'),
      (r_org.id, 'manager', 'financial_reports_view'),
      (r_org.id, 'manager', 'profit_reports_view'),
      (r_org.id, 'manager', 'customer_statement_view'),
      (r_org.id, 'manager', 'supplier_statement_view'),
      (r_org.id, 'manager', 'barcode_label_print')
    ON CONFLICT DO NOTHING;

    -- Store keeper: supplier statements and barcode labels
    INSERT INTO role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'inventory', 'supplier_statement_view'),
      (r_org.id, 'inventory', 'barcode_label_print'),
      (r_org.id, 'inventory', 'reports_view')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
