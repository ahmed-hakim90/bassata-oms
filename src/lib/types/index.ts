import type {
  COST_CENTER_TYPES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_SOURCES,
  EXPENSE_STATUSES,
  MOVEMENT_TYPES,
  MEASUREMENT_UNITS,
  ONLINE_ORDER_STATUSES,
  ORDER_STATUSES,
  SALES_DOCUMENT_STATUSES,
  PAYMENT_METHODS,
  PERMISSIONS,
  PRODUCT_TYPES,
  SESSION_LIFECYCLE_STATES,
  SESSION_STATUSES,
  UserRole,
  BusinessActivityType,
  InventoryTrackingMode,
  InventoryRotationMethod,
  ExpiryPolicy,
  ProductSalesUnitType,
  ShelfLifeUnit,
  SalesMode,
  VariantKind,
  VariantPriceMode,
  WeightSaleInputMode,
} from "@/lib/constants";

export type {
  BusinessActivityType,
  BusinessActivitySettings,
  InventoryTrackingMode,
  InventoryRotationMethod,
  ExpiryPolicy,
  ProductSalesUnitType,
  ShelfLifeUnit,
  SalesMode,
  VariantKind,
  VariantPriceMode,
  WeightSaleInputMode,
} from "@/lib/constants";

export type { UserRole } from "@/lib/constants";

export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type SalesDocumentStatus = (typeof SALES_DOCUMENT_STATUSES)[number];
export type OnlineOrderStatus = (typeof ONLINE_ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type SessionLifecycleState = (typeof SESSION_LIFECYCLE_STATES)[number];
export type CostCenterType = (typeof COST_CENTER_TYPES)[number];
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type PermissionKey = (typeof PERMISSIONS)[number];

export interface Organization {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  country: string;
  status: "active" | "suspended";
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Store {
  id: string;
  org_id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  timezone: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
}

export interface Warehouse {
  id: string;
  org_id: string;
  store_id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  org_id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  store_ids: string[];
}

export interface Device {
  id: string;
  store_id: string;
  name: string;
  device_key_hash?: string;
  is_active: boolean;
  last_seen_at: string | null;
}

export interface Category {
  id: string;
  org_id: string;
  name: string;
  sort_order: number;
  color: string;
  icon: string;
  expiry_tracking_enabled_default?: boolean;
  inventory_rotation_method_default?: InventoryRotationMethod;
  expiry_policy_default?: ExpiryPolicy;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  base_price: number;
  description: string;
  sale_price: number | null;
  image_url: string | null;
  is_active: boolean;
  is_popular: boolean;
  /** Public online menu visibility (§8.2). Defaults false for raw; true for finished on create. */
  show_on_online_menu?: boolean;
  track_inventory: boolean;
  product_type: ProductType;
  inventory_product_type?: ProductType;
  inventory_tracking_mode?: InventoryTrackingMode;
  inventory_rotation_method?: InventoryRotationMethod;
  expiry_policy?: ExpiryPolicy;
  expiry_tracking_enabled?: boolean;
  shelf_life_value?: number;
  shelf_life_unit?: ShelfLifeUnit;
  unit: MeasurementUnit;
  sale_unit?: MeasurementUnit;
  base_unit?: MeasurementUnit;
  sales_unit_type?: ProductSalesUnitType;
  allow_fractional_quantity?: boolean;
  allow_price_input?: boolean;
  wholesale_enabled?: boolean;
  supports_weight_sale?: boolean;
  supports_amount_sale?: boolean;
  last_unit_cost: number;
  cost_unit: MeasurementUnit;
  /** Base units inside one cost_unit (e.g. 24 pieces per carton). Default 1. */
  units_per_purchase_unit?: number;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  org_id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  batch_number: string;
  source_type: "purchase" | "opening_stock" | "transfer" | "production" | "adjustment";
  source_document_id: string | null;
  supplier_id: string | null;
  purchase_invoice_id: string | null;
  received_date: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number;
  remaining_quantity: number;
  unit: MeasurementUnit;
  is_expired: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Product size/option (Small, Large, etc.). Supports future modifiers via order_items.modifiers. */
export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  barcode: string;
  price_delta: number;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
  variant_kind: VariantKind;
  quantity_value: number | null;
  quantity_unit: MeasurementUnit | null;
  price_mode: VariantPriceMode | null;
  fixed_price: number | null;
}

export interface ProductPriceTier {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sale_mode: SalesMode;
  min_quantity: number;
  unit: MeasurementUnit;
  price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reorder_point: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  movement_type: MovementType;
  quantity_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  contact_info: string;
  /** Prior AP owed to supplier before tracked purchases (org-level). */
  opening_balance: number;
}

export interface SupplierPayment {
  id: string;
  org_id: string;
  store_id: string;
  supplier_id: string;
  /** When set, cash payments reduce that session’s expected drawer cash. */
  session_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  reference: string;
  notes: string;
  paid_at: string;
  created_by: string;
  created_at: string;
  voided_at: string | null;
}

export type SupplierStatementTransactionType =
  | "purchase"
  | "purchase_void"
  | "payment"
  | "payment_void";

export interface SupplierStatementTransaction {
  id: string;
  at: string;
  type: SupplierStatementTransactionType;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  /** Set for purchase / purchase_void rows — links to purchase invoice */
  purchaseInvoiceId?: string;
}

export interface SupplierStatement {
  supplier: Supplier;
  openingBalance: number;
  transactions: SupplierStatementTransaction[];
  closingBalance: number;
}

export interface SupplierListSummary extends Supplier {
  totalPurchased: number;
  totalPaid: number;
  balanceDue: number;
  invoiceCount: number;
  lastActivityAt: string | null;
}

export interface PurchaseInvoice {
  id: string;
  store_id: string;
  warehouse_id: string;
  supplier_id: string;
  invoice_number: string;
  status: "draft" | "received" | "cancelled";
  subtotal: number;
  extra_cost: number;
  tax: number;
  total: number;
  /** Business calendar date (YYYY-MM-DD); editable on drafts. */
  document_date: string;
  received_at: string | null;
  cancelled_at: string | null;
  created_by: string;
  created_at: string;
}

export interface PurchaseInvoiceLine {
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
}

export interface TransferOrder {
  id: string;
  from_store_id: string;
  to_store_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: "draft" | "sent" | "received" | "cancelled";
  sent_at: string | null;
  received_at: string | null;
  created_by: string;
  created_at: string;
}

export interface TransferOrderLine {
  id: string;
  transfer_id: string;
  product_id: string;
  variant_id: string | null;
  quantity_sent: number;
  quantity_received: number;
  batch_id?: string | null;
  batch_number?: string | null;
}

export interface WasteRecord {
  id: string;
  store_id: string;
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  batch_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  reason_code: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export type StockCountStatus =
  | "in_progress"
  | "pending_approval"
  | "approved"
  | "completed";

export interface StockCount {
  id: string;
  store_id: string;
  warehouse_id: string;
  status: StockCountStatus;
  started_at: string;
  completed_at: string | null;
  created_by: string;
}

export interface StockCountLine {
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
}

export interface CashierSession {
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
  status: SessionStatus;
  notes: string | null;
  closed_by: string | null;
  close_reason: string | null;
  force_closed: boolean;
}

export type CashierVaultEntryType =
  | "session_close_deposit"
  | "session_open_float"
  | "admin_withdraw";

/** Per cashier amanah (خزينة) at a store — separate from session drawer (درج). */
export interface CashierVault {
  id: string;
  org_id: string;
  store_id: string;
  cashier_id: string;
  balance: number;
  pending_opening_float: number;
  created_at: string;
  updated_at: string;
}

export interface CashierVaultLedgerEntry {
  id: string;
  org_id: string;
  store_id: string;
  cashier_id: string;
  vault_id: string;
  entry_type: CashierVaultEntryType;
  amount: number;
  balance_after: number;
  session_id: string | null;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface SessionSettings {
  max_open_hours: number;
  warn_after_hours: number;
  block_sales_when_expired: boolean;
  require_manager_override_for_expired_sale: boolean;
  allow_manager_force_close: boolean;
  manager_discount_override_amount: number | null;
}

export interface Order {
  id: string;
  store_id: string;
  session_id: string | null;
  order_number: string;
  customer_id: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  /** Cart-level promotion discount (included in discount). */
  promo_discount?: number;
  tax: number;
  total: number;
  payment_status: "paid" | "unpaid" | "partial";
  created_by: string;
  created_at: string;
  sales_mode?: SalesMode;
  activity_type?: BusinessActivityType;
  document_status?: SalesDocumentStatus | null;
  /** Business calendar date (YYYY-MM-DD); editable on sales-invoice drafts. */
  document_date?: string;
  issued_at?: string | null;
  delivered_at?: string | null;
  warehouse_id?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  /** Unit price before item promo (after tiers / scheduled sale). */
  list_unit_price?: number | null;
  /** Item-level promotion savings. */
  discount_amount?: number;
  promotion_rule_id?: string | null;
  modifiers: { name: string; price: number }[];
  line_total: number;
  unit_cost: number;
  line_cost: number;
  sale_unit: MeasurementUnit | null;
  base_quantity: number | null;
  sale_input_mode: WeightSaleInputMode | null;
  tier_id: string | null;
  wholesale_applied: boolean;
  line_note: string | null;
}

export interface OrderItemDeduction {
  id: string;
  order_item_id: string;
  ingredient_product_id: string;
  quantity: number;
  unit: MeasurementUnit;
  unit_cost: number;
  line_cost: number;
}

export interface ProductRecipe {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRecipeLine {
  id: string;
  recipe_id: string;
  ingredient_product_id: string;
  quantity: number;
  unit: MeasurementUnit;
  sort_order: number;
}

export interface ProductRecipeLineWithProduct extends ProductRecipeLine {
  ingredient_name: string;
  ingredient_unit: MeasurementUnit;
  ingredient_last_unit_cost: number;
  ingredient_cost_unit: MeasurementUnit;
  line_cost: number;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
}

export type OnlineOrderFulfillmentType = "pickup" | "delivery";

export interface OnlineOrder {
  id: string;
  store_id: string;
  order_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: OnlineOrderStatus;
  subtotal: number;
  discount: number;
  promo_discount?: number;
  coupon_code?: string | null;
  tax: number;
  total: number;
  notes: string;
  fulfillment_type: OnlineOrderFulfillmentType | null;
  delivery_area: string;
  delivery_address: string;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
}

export interface OnlineOrderItem {
  id: string;
  online_order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  list_unit_price?: number | null;
  discount_amount?: number;
  promotion_rule_id?: string | null;
  line_total: number;
  created_at: string;
}

export type PromotionRuleType =
  | "percent_off_item"
  | "fixed_off_item"
  | "scheduled_sale_price"
  | "cart_percent"
  | "cart_fixed"
  | "bogo"
  | "qty_threshold";

export type PromotionScopeType = "all" | "product" | "category";

export interface PromotionRule {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  rule_type: PromotionRuleType;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  store_ids: string[] | null;
  sale_modes: ("retail" | "wholesale")[];
  coupon_code: string | null;
  stackable_with_cart: boolean;
  min_subtotal: number;
  scope_type: PromotionScopeType;
  scope_ids: string[];
  config: Record<string, number | undefined>;
  usage_limit_total: number | null;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderPromotionApplication {
  id: string;
  order_id: string;
  promotion_rule_id: string | null;
  order_item_id: string | null;
  level: "item" | "cart";
  amount: number;
  rule_name: string | null;
  created_at: string;
}

export interface CostCenter {
  id: string;
  org_id: string;
  store_id: string | null;
  name: string;
  code: string;
  type: CostCenterType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  org_id: string;
  cost_center_id: string;
  name: string;
  is_active: boolean;
  requires_inventory_item: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  key: string;
  label: string;
  description: string;
  group_name: string;
}

export interface ExpenseSettings {
  approval_required: boolean;
  cashier_can_add_session_expense: boolean;
  cashier_max_expense_amount: number | null;
  allow_inventory_purchase_from_session: boolean;
  default_cost_center_packaging: string | null;
  default_cost_center_cleaning: string | null;
  default_cost_center_utilities: string | null;
  prevent_expenses_in_closed_periods: boolean;
}

export interface Expense {
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
  payment_method: ExpensePaymentMethod;
  expense_source: ExpenseSource;
  notes: string;
  receipt_url: string | null;
  status: ExpenseStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpenseWithDetails extends Expense {
  cost_center_name?: string;
  category_name?: string;
  inventory_item_name?: string;
  supplier_name?: string;
  cashier_name?: string;
}

export interface Customer {
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
}

export type CustomerLedgerEntryType =
  | "credit_sale"
  | "payment_received"
  | "refund"
  | "adjustment";

export interface CustomerLedgerEntry {
  id: string;
  org_id: string;
  store_id: string;
  customer_id: string;
  entry_type: CustomerLedgerEntryType;
  debit: number;
  credit: number;
  order_id: string | null;
  payment_id: string | null;
  reference: string;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  org_id: string;
  store_id: string;
  customer_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference: string;
  notes: string;
  received_at: string;
  created_by: string;
  created_at: string;
  voided_at: string | null;
}

export interface CustomerStatementTransaction {
  id: string;
  at: string;
  type: CustomerLedgerEntryType;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  openingBalance: number;
  closingBalance: number;
  transactions: CustomerStatementTransaction[];
}

export interface LoyaltyRule {
  id: string;
  org_id: string;
  points_per_currency: number;
  redemption_rate: number;
  minimum_redeem_points: number;
  is_active: boolean;
}

export interface LoyaltyLedgerEntry {
  id: string;
  customer_id: string;
  order_id: string | null;
  points_delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  store_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppSetting {
  id: string;
  org_id: string;
  key: string;
  value: Record<string, unknown>;
}

export interface PinAttempt {
  id: string;
  org_id: string;
  store_id: string;
  attempted_by: string | null;
  success: boolean;
  created_at: string;
}

export interface ImportJob {
  id: string;
  org_id: string;
  type: string;
  status: "pending" | "completed" | "failed";
  file_url: string | null;
  result: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface AuthContext {
  user: AppUser;
  activeStoreId: string | null;
  deviceUnlocked: boolean;
  cashierId: string | null;
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  categoryId?: string | null;
  /** Preview savings from an item promotion (display only). */
  promoDiscountAmount?: number;
  modifiers: { name: string; price: number }[];
  lineTotal: number;
  imageUrl: string | null;
  saleUnit?: MeasurementUnit;
  saleInputMode?: WeightSaleInputMode;
  enteredAmount?: number;
  tierId?: string | null;
  wholesaleApplied?: boolean;
}
