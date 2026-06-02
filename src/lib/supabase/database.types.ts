export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDef<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Row>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type FnDef<Args extends Record<string, unknown>, Returns> = {
  Args: Args;
  Returns: Returns;
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<OrganizationRow>;
      stores: TableDef<StoreRow>;
      warehouses: TableDef<WarehouseRow>;
      users: TableDef<UserRow>;
      user_store_access: TableDef<
        { user_id: string; store_id: string },
        { user_id: string; store_id: string },
        never
      >;
      pin_codes: TableDef<
        { id: string; user_id: string; pin_hash: string; is_active: boolean },
        { user_id: string; pin_hash: string; is_active?: boolean },
        { is_active?: boolean }
      >;
      pin_attempts: TableDef<PinAttemptRow, never, never>;
      devices: TableDef<DeviceRow>;
      device_pairing_codes: TableDef<DevicePairingCodeRow, Partial<DevicePairingCodeRow>, never>;
      user_device_access: TableDef<
        { user_id: string; device_id: string; is_active: boolean },
        { user_id: string; device_id: string; is_active?: boolean },
        { is_active?: boolean }
      >;
      categories: TableDef<CategoryRow>;
      products: TableDef<ProductRow>;
      product_variants: TableDef<VariantRow>;
      product_price_tiers: TableDef<ProductPriceTierRow>;
      product_recipes: TableDef<RecipeRow>;
      product_recipe_lines: TableDef<RecipeLineRow>;
      stock_levels: TableDef<StockLevelRow>;
      inventory_movements: TableDef<MovementRow, Partial<MovementRow>, never>;
      suppliers: TableDef<SupplierRow>;
      supplier_payments: TableDef<SupplierPaymentRow, Partial<SupplierPaymentRow>, Partial<SupplierPaymentRow>>;
      purchase_invoices: TableDef<PurchaseRow>;
      purchase_invoice_lines: TableDef<PurchaseLineRow>;
      transfer_orders: TableDef<TransferRow>;
      transfer_order_lines: TableDef<TransferLineRow>;
      waste_records: TableDef<WasteRow, Partial<WasteRow>, never>;
      stock_counts: TableDef<StockCountRow>;
      stock_count_lines: TableDef<StockCountLineRow>;
      cashier_sessions: TableDef<SessionRow>;
      customers: TableDef<CustomerRow>;
      online_orders: TableDef<OnlineOrderRow, Partial<OnlineOrderRow>, Partial<OnlineOrderRow>>;
      online_order_items: TableDef<OnlineOrderItemRow, Partial<OnlineOrderItemRow>, Partial<OnlineOrderItemRow>>;
      souqna_integration_logs: TableDef<SouqnaIntegrationLogRow, Partial<SouqnaIntegrationLogRow>, never>;
      souqna_api_requests: TableDef<SouqnaApiRequestRow, Partial<SouqnaApiRequestRow>, never>;
      orders: TableDef<OrderRow>;
      order_items: TableDef<OrderItemRow, Partial<OrderItemRow>, never>;
      order_item_deductions: TableDef<OrderItemDeductionRow, never, never>;
      order_payments: TableDef<OrderPaymentRow, Partial<OrderPaymentRow>, never>;
      expenses: TableDef<ExpenseRow>;
      cost_centers: TableDef<CostCenterRow>;
      expense_categories: TableDef<ExpenseCategoryRow>;
      permissions: TableDef<PermissionRow, never, never>;
      role_permissions: TableDef<
        RolePermissionRow,
        RolePermissionRow,
        never
      >;
      user_permission_grants: TableDef<
        UserPermissionGrantRow,
        UserPermissionGrantRow,
        Partial<UserPermissionGrantRow>
      >;
      loyalty_rules: TableDef<LoyaltyRuleRow>;
      loyalty_ledger: TableDef<LoyaltyLedgerRow, Partial<LoyaltyLedgerRow>, never>;
      monthly_closes: TableDef<MonthlyCloseRow>;
      import_jobs: TableDef<ImportJobRow>;
      audit_logs: TableDef<AuditLogRow, never, never>;
      app_settings: TableDef<AppSettingRow>;
    };
    Views: Record<string, never>;
    Functions: {
      insert_audit_log: FnDef<
        {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string;
          p_store_id?: string;
          p_metadata?: Json;
        },
        string
      >;
      verify_cashier_pin: FnDef<
        { p_store_id: string; p_pin: string; p_device_id: string },
        string
      >;
      consume_device_pairing_code: FnDef<{ p_code: string }, { device_id: string; store_id: string }[]>;
      create_device_pairing_code: FnDef<{ p_device_id: string }, string>;
      touch_device_seen: FnDef<{ p_device_id: string }, void>;
      cashier_can_use_device: FnDef<
        { p_user_id: string; p_store_id: string; p_device_id: string },
        boolean
      >;
      set_user_pin: FnDef<{ p_user_id: string; p_pin: string }, void>;
      complete_checkout: FnDef<Record<string, unknown>, Json>;
      complete_unpaid_checkout: FnDef<Record<string, unknown>, Json>;
      compute_recipe_cost: FnDef<{ p_recipe_id: string }, number>;
      convert_unit: FnDef<
        { p_qty: number; p_from: string; p_to: string },
        number
      >;
      can_view_costs: FnDef<Record<string, never>, boolean>;
      is_period_closed: FnDef<{ p_store_id: string; p_at: string }, boolean>;
      is_feature_enabled: FnDef<{ p_flag: string }, boolean>;
      require_feature: FnDef<{ p_flag: string }, void>;
      set_default_warehouse: FnDef<{ p_store_id: string; p_warehouse_id: string }, void>;
      assert_souqna_rate_limit: FnDef<{ p_prefix: string }, void>;
      has_permission: FnDef<{ p_key: string }, boolean>;
      auth_user_id: FnDef<Record<string, never>, string>;
      deployment_has_organization: FnDef<Record<string, never>, boolean>;
      initialize_organization: FnDef<
        {
          p_org_name: string;
          p_logo_url: string;
          p_currency: string;
          p_timezone: string;
          p_country: string;
          p_store_name: string;
          p_store_code: string;
          p_store_address: string;
          p_store_phone: string;
          p_store_timezone: string;
          p_tax_enabled: boolean;
          p_tax_rate: number;
          p_tax_inclusive: boolean;
          p_receipt_header: string;
          p_receipt_footer: string;
          p_feature_flags: Json;
          p_business_activity: Json;
          p_session_settings: Json;
          p_expense_settings: Json;
          p_payment_methods: Json;
          p_prevent_negative_stock: boolean;
          p_default_tax_behavior: string;
          p_seed_defaults: Json;
          p_owner_email: string;
        },
        Json
      >;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type OrganizationRow = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  country: string;
  settings: Json;
  created_at: string;
};
export type StoreRow = {
  id: string;
  org_id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  timezone: string | null;
  is_active: boolean;
  settings: Json;
};
export type WarehouseRow = {
  id: string;
  org_id: string;
  store_id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
};
export type UserRow = {
  id: string;
  org_id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};
export type PinAttemptRow = {
  id: string;
  org_id: string;
  store_id: string;
  attempted_by: string | null;
  success: boolean;
  created_at: string;
};
export type DeviceRow = {
  id: string;
  store_id: string;
  name: string;
  device_key_hash: string;
  is_active: boolean;
  last_seen_at: string | null;
};
export type DevicePairingCodeRow = {
  id: string;
  device_id: string;
  code_hash: string;
  expires_at: string;
  used_at: string | null;
  created_by: string;
  created_at: string;
};
export type CategoryRow = {
  id: string;
  org_id: string;
  name: string;
  sort_order: number;
  color: string;
  icon: string;
  expiry_tracking_enabled_default?: boolean;
  inventory_rotation_method_default?: string;
  expiry_policy_default?: string;
};
export type ProductRow = {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  base_price: number;
  image_url: string | null;
  is_active: boolean;
  is_popular: boolean;
  track_inventory: boolean;
  product_type: string;
  inventory_product_type?: string;
  inventory_tracking_mode?: string;
  inventory_rotation_method?: string;
  expiry_policy?: string;
  expiry_tracking_enabled?: boolean;
  shelf_life_days?: number;
  shelf_life_months?: number;
  shelf_life_years?: number;
  unit: string;
  base_unit?: string;
  sale_unit: string;
  sales_unit_type: string;
  allow_fractional_quantity: boolean;
  allow_price_input: boolean;
  wholesale_enabled: boolean;
  supports_weight_sale?: boolean;
  supports_amount_sale?: boolean;
  last_unit_cost: number;
  cost_unit: string;
  description: string;
  sale_price: number | null;
  publish_to_souqna: boolean;
  created_at: string;
  updated_at: string;
};
export type RecipeRow = {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: string;
  updated_at: string;
};
export type RecipeLineRow = {
  id: string;
  recipe_id: string;
  ingredient_product_id: string;
  quantity: number;
  unit: string;
  sort_order: number;
};
export type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  barcode: string;
  price_delta: number;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
  variant_kind: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  price_mode: string | null;
  fixed_price: number | null;
};
export type ProductPriceTierRow = {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sale_mode: string;
  min_quantity: number;
  unit: string;
  price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type StockLevelRow = {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reorder_point: number;
  reserved_quantity: number;
  updated_at: string;
};
export type MovementRow = {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  movement_type: string;
  quantity_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  batch_id?: string | null;
  batch_number?: string | null;
  serial_number?: string | null;
  expiry_date?: string | null;
  created_by: string;
  created_at: string;
};
export type SupplierRow = {
  id: string;
  org_id: string;
  name: string;
  contact_info: string;
};
export type PurchaseRow = {
  id: string;
  store_id: string;
  warehouse_id: string;
  supplier_id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  extra_cost: number;
  tax: number;
  total: number;
  received_at: string | null;
  cancelled_at: string | null;
  created_by: string;
  created_at: string;
};
export type SupplierPaymentRow = {
  id: string;
  org_id: string;
  store_id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
  paid_at: string;
  created_by: string;
  created_at: string;
  voided_at: string | null;
};
export type PurchaseLineRow = {
  id: string;
  invoice_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  landed_unit_cost: number | null;
  landed_line_total: number | null;
  batch_number?: string | null;
  production_date?: string | null;
  expiry_date?: string | null;
};
export type TransferRow = {
  id: string;
  from_store_id: string;
  to_store_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  created_by: string;
  created_at: string;
};
export type TransferLineRow = {
  id: string;
  transfer_id: string;
  product_id: string;
  variant_id: string | null;
  quantity_sent: number;
  quantity_received: number;
  batch_id?: string | null;
  batch_number?: string | null;
};
export type WasteRow = {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reason_code: string;
  notes: string;
  batch_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  created_by: string;
  created_at: string;
};
export type StockCountRow = {
  id: string;
  store_id: string;
  warehouse_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_by: string;
};
export type StockCountLineRow = {
  id: string;
  count_id: string;
  product_id: string;
  variant_id: string | null;
  expected_qty: number;
  counted_qty: number;
  variance: number;
  batch_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
};
export type InventoryBatchRow = {
  id: string;
  org_id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  batch_number: string;
  source_type: string;
  source_document_id: string | null;
  supplier_id: string | null;
  purchase_invoice_id: string | null;
  received_date: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number;
  remaining_quantity: number;
  unit: string;
  is_expired: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type SessionRow = {
  id: string;
  store_id: string;
  device_id: string | null;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number | null;
  actual_cash: number | null;
  variance: number | null;
  status: string;
  notes: string | null;
  closed_by: string | null;
  close_reason: string | null;
  force_closed: boolean;
};
export type CustomerRow = {
  id: string;
  org_id: string;
  name: string;
  phone: string;
  email: string | null;
  total_spent: number;
  visit_count: number;
  account_balance: number;
  credit_limit: number;
  payment_terms: string;
  notes: string;
  created_at: string;
};
export type OnlineOrderRow = {
  id: string;
  store_id: string;
  customer_id: string | null;
  order_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string;
  source: string;
  external_order_id: string | null;
  checkout_session_id: string | null;
  fulfillment_type: string | null;
  delivery_area: string | null;
  delivery_address: string | null;
  delivery_fee: number;
  payment_method: string | null;
  raw_payload: Json | null;
  created_at: string;
  updated_at: string;
};
export type SouqnaIntegrationLogRow = {
  id: string;
  org_id: string;
  store_id: string | null;
  direction: string;
  endpoint: string;
  request_type: string;
  request_payload: Json | null;
  response_payload: Json | null;
  status: string;
  error: string | null;
  created_at: string;
};
export type SouqnaApiRequestRow = {
  id: string;
  api_key_hash_prefix: string;
  requested_at: string;
};
export type OnlineOrderItemRow = {
  id: string;
  online_order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};
export type OrderRow = {
  id: string;
  store_id: string;
  session_id: string | null;
  order_number: string;
  customer_id: string | null;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_status: string;
  sales_mode: string;
  activity_type: string;
  created_by: string;
  created_at: string;
};
export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  modifiers: Json;
  line_total: number;
  unit_cost: number;
  line_cost: number;
  sale_unit: string | null;
  base_quantity: number | null;
  sale_input_mode: string | null;
  tier_id: string | null;
  wholesale_applied: boolean;
  line_note: string | null;
};
export type OrderItemDeductionRow = {
  id: string;
  order_item_id: string;
  ingredient_product_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  line_cost: number;
};
export type OrderPaymentRow = {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  reference: string | null;
};
export type ExpenseRow = {
  id: string;
  store_id: string;
  session_id: string | null;
  cost_center_id: string;
  expense_category_id: string;
  inventory_item_id: string | null;
  supplier_id: string | null;
  title: string;
  amount: number;
  quantity: number | null;
  unit_cost: number | null;
  payment_method: string;
  expense_source: string;
  notes: string;
  receipt_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
};
export type CostCenterRow = {
  id: string;
  org_id: string;
  store_id: string | null;
  name: string;
  code: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type ExpenseCategoryRow = {
  id: string;
  org_id: string;
  cost_center_id: string;
  name: string;
  is_active: boolean;
  requires_inventory_item: boolean;
  created_at: string;
  updated_at: string;
};
export type PermissionRow = {
  key: string;
  label: string;
  description: string;
  group_name: string;
};
export type RolePermissionRow = {
  org_id: string;
  role: string;
  permission_key: string;
};
export type UserPermissionGrantRow = {
  user_id: string;
  permission_key: string;
  granted: boolean;
};
export type LoyaltyRuleRow = {
  id: string;
  org_id: string;
  points_per_currency: number;
  redemption_rate: number;
  is_active: boolean;
};
export type LoyaltyLedgerRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  points_delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
};
export type MonthlyCloseRow = {
  id: string;
  org_id: string;
  store_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  summary: Json;
  closed_by: string | null;
  closed_at: string | null;
};
export type ImportJobRow = {
  id: string;
  org_id: string;
  type: string;
  status: string;
  file_url: string | null;
  result: Json;
  created_by: string;
  created_at: string;
};
export type AuditLogRow = {
  id: string;
  org_id: string;
  store_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
};
export type AppSettingRow = {
  id: string;
  org_id: string;
  key: string;
  value: Json;
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
