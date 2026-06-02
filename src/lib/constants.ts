export const APP_NAME = "SweetFlow POS";

export const ROLES = ["owner", "manager", "cashier", "inventory", "viewer"] as const;
export type UserRole = (typeof ROLES)[number];

export const ORDER_STATUSES = ["open", "completed", "voided", "refunded"] as const;
export const ONLINE_ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "cancelled",
  "invoiced",
] as const;
export const PAYMENT_METHODS = ["cash", "card", "wallet", "other", "credit"] as const;
export const SESSION_STATUSES = ["open", "closed"] as const;
export const SESSION_LIFECYCLE_STATES = ["open", "warning", "expired_locked"] as const;
export type SessionLifecycleState = (typeof SESSION_LIFECYCLE_STATES)[number];
export const MOVEMENT_TYPES = [
  "sale",
  "purchase",
  "purchase_from_session",
  "transfer_in",
  "transfer_out",
  "waste",
  "adjustment",
  "stock_count",
  "reservation",
  "reservation_release",
] as const;

export const COST_CENTER_TYPES = [
  "operations",
  "cleaning",
  "utilities",
  "packaging",
  "maintenance",
  "salaries",
  "marketing",
  "other",
] as const;
export type CostCenterType = (typeof COST_CENTER_TYPES)[number];

export const EXPENSE_PAYMENT_METHODS = ["cash", "card", "wallet", "other"] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const EXPENSE_SOURCES = ["session_cash", "external", "purchase"] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_STATUSES = ["pending", "approved"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const PERMISSIONS = [
  // Expenses / accounting (011)
  "expense_create",
  "expense_edit",
  "expense_delete",
  "expense_view_all",
  "expense_approve",
  "cost_center_manage",
  "expense_category_manage",
  "session_expense_create",
  "purchase_from_session_create",
  // POS
  "pos_access",
  "checkout_create",
  // Orders
  "order_view",
  "order_void",
  "order_refund",
  "online_order_manage",
  // Products
  "product_manage",
  "recipe_manage",
  // Inventory
  "inventory_view",
  "purchase_manage",
  "transfer_manage",
  "waste_manage",
  "stock_count_manage",
  // Sessions
  "session_open",
  "session_close",
  "session_view",
  "session_view_all",
  "session_force_close",
  "session_settings_manage",
  // Customers
  "customer_manage",
  "customer_credit_sale",
  "customer_payment_receive",
  "customer_ledger_view",
  "loyalty_manage",
  // Reports
  "reports_view",
  "costs_view",
  // System
  "settings_manage",
  "user_manage",
  "audit_view",
  "imports_exports",
  "monthly_closing_manage",
  "monthly_closing_reopen",
  "wholesale_sale",
  "price_by_amount_sale",
  "weight_sale",
  "manage_business_activity",
  "manage_price_tiers",
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export const BUSINESS_ACTIVITY_TYPES = [
  "cafe",
  "ice_cream",
  "restaurant",
  "supermarket",
  "retail",
  "wholesale",
  "mixed",
] as const;
export type BusinessActivityType = (typeof BUSINESS_ACTIVITY_TYPES)[number];

export const SALES_MODES = ["retail", "wholesale"] as const;
export type SalesMode = (typeof SALES_MODES)[number];

export const PRODUCT_SALES_UNIT_TYPES = [
  "piece",
  "weight",
  "volume",
  "pack",
  "mixed",
] as const;
export type ProductSalesUnitType = (typeof PRODUCT_SALES_UNIT_TYPES)[number];

export const VARIANT_KINDS = ["standard", "weight_portion"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export const VARIANT_PRICE_MODES = ["calculate_from_unit_price", "fixed_price"] as const;
export type VariantPriceMode = (typeof VARIANT_PRICE_MODES)[number];

export const WEIGHT_SALE_INPUT_MODES = ["by_weight", "by_amount"] as const;
export type WeightSaleInputMode = (typeof WEIGHT_SALE_INPUT_MODES)[number];

/** Minimum permission to access a nav route (owner bypasses). */
export const PATH_PERMISSIONS: Partial<Record<string, PermissionKey | PermissionKey[]>> = {
  "/": "order_view",
  "/pos": "pos_access",
  "/orders": "order_view",
  "/orders/online": "online_order_manage",
  "/products": "product_manage",
  "/inventory": "inventory_view",
  "/inventory/purchases": "purchase_manage",
  "/inventory/suppliers": "purchase_manage",
  "/inventory/transfers": "transfer_manage",
  "/inventory/waste": "waste_manage",
  "/inventory/stock-count": "stock_count_manage",
  "/inventory/movements": "inventory_view",
  "/sessions": "session_view",
  "/expenses": "expense_view_all",
  "/customers": "customer_manage",
  "/customers/loyalty": "loyalty_manage",
  "/reports": "reports_view",
  "/monthly-closing": "monthly_closing_manage",
  "/imports-exports": "imports_exports",
  "/settings": [
    "settings_manage",
    "session_settings_manage",
    "user_manage",
    "cost_center_manage",
    "audit_view",
  ],
  "/settings/cost-centers": "cost_center_manage",
  "/users": "user_manage",
  "/audit": "audit_view",
  "/organization": "settings_manage",
};

export const PRODUCT_TYPES = [
  "finished_product",
  "raw_material",
  "semi_finished",
  "packaging_material",
  "consumable",
  "service",
  "asset",
  // Legacy aliases kept for compatibility with existing data.
  "finished",
  "ingredient",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MEASUREMENT_UNITS = [
  "piece",
  "kg",
  "gram",
  "liter",
  "ml",
  "carton",
  "box",
  "pack",
  "meter",
  // Legacy units kept for compatibility.
  "bag",
  "cup",
  "spoon",
] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const INVENTORY_TRACKING_MODES = [
  "none",
  "standard",
  "batch",
  "batch_and_expiry",
  "serial_number",
] as const;
export type InventoryTrackingMode = (typeof INVENTORY_TRACKING_MODES)[number];

export const INVENTORY_ROTATION_METHODS = ["FIFO", "FEFO", "MANUAL"] as const;
export type InventoryRotationMethod = (typeof INVENTORY_ROTATION_METHODS)[number];

export const EXPIRY_POLICIES = ["block_sale", "warn_only", "manager_override"] as const;
export type ExpiryPolicy = (typeof EXPIRY_POLICIES)[number];

export function canViewCosts(role: UserRole, permissions?: Set<PermissionKey>): boolean {
  if (permissions?.has("costs_view")) return true;
  return role === "owner" || role === "manager";
}

export const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
      { label: "POS", href: "/pos", icon: "ShoppingCart" },
      { label: "Orders", href: "/orders", icon: "Receipt" },
      { label: "Online Orders", href: "/orders/online", icon: "ClipboardList" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Products", href: "/products", icon: "Package" },
      { label: "Inventory", href: "/inventory", icon: "Warehouse" },
      { label: "Movements", href: "/inventory/movements", icon: "History" },
      { label: "Purchases", href: "/inventory/purchases", icon: "Truck" },
      { label: "Suppliers", href: "/inventory/suppliers", icon: "Landmark" },
      { label: "Transfers", href: "/inventory/transfers", icon: "ArrowLeftRight" },
      { label: "Waste", href: "/inventory/waste", icon: "Trash2" },
      { label: "Stock Count", href: "/inventory/stock-count", icon: "ClipboardList" },
      { label: "Sessions", href: "/sessions", icon: "Clock" },
      { label: "Expenses", href: "/expenses", icon: "Wallet" },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customers", href: "/customers", icon: "Users" },
      { label: "Loyalty", href: "/customers/loyalty", icon: "Heart" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: "BarChart3" },
      { label: "Monthly Closing", href: "/monthly-closing", icon: "CalendarCheck" },
      { label: "Imports/Exports", href: "/imports-exports", icon: "FileSpreadsheet" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Organization", href: "/organization", icon: "Building2" },
      { label: "Settings", href: "/settings", icon: "Settings" },
    ],
  },
] as const;

/** Seed default store (Downtown) — used when no active store cookie */
export const DEFAULT_STORE_ID = "00000000-0000-4000-8000-000000000101";

export const FEATURE_FLAGS = [
  "receipt_printing",
  "barcode_scanner",
  "inventory_deduction",
  "loyalty",
  "customer_discounts",
  "reports",
  "imports_exports",
  "monthly_closing",
  "cash_drawer",
  "dark_mode",
  "tax",
  "payment_cash",
  "payment_card",
  "payment_wallet",
  "payment_other",
  "prevent_negative_stock",
  "session_expenses",
  "refunds",
  "stock_count",
  "transfers",
  "purchases",
  "waste",
  "recipes",
  "credit_sales",
  "online_menu",
  "online_orders",
  "souqna_integration",
  "supermarket_mode",
  "weight_sales",
  "price_by_amount",
  "wholesale_sales",
  "product_price_tiers",
  "fixed_weight_variants",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Daily POS / receipt toggles — shown under POS & Sessions, not System Features. */
export const POS_OPERATIONAL_FEATURE_FLAGS = [
  "payment_cash",
  "payment_card",
  "payment_wallet",
  "payment_other",
  "receipt_printing",
  "cash_drawer",
  "tax",
] as const satisfies readonly FeatureFlag[];

export type PosOperationalFeatureFlag = (typeof POS_OPERATIONAL_FEATURE_FLAGS)[number];

export const ADVANCED_FEATURE_FLAGS = FEATURE_FLAGS.filter(
  (flag) => !(POS_OPERATIONAL_FEATURE_FLAGS as readonly string[]).includes(flag)
);

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  receipt_printing: true,
  barcode_scanner: true,
  inventory_deduction: true,
  loyalty: true,
  customer_discounts: false,
  reports: true,
  imports_exports: true,
  monthly_closing: true,
  cash_drawer: false,
  dark_mode: true,
  tax: true,
  payment_cash: true,
  payment_card: true,
  payment_wallet: true,
  payment_other: true,
  prevent_negative_stock: true,
  session_expenses: true,
  refunds: false,
  stock_count: true,
  transfers: true,
  purchases: true,
  waste: true,
  recipes: false,
  credit_sales: false,
  online_menu: true,
  online_orders: true,
  souqna_integration: false,
  supermarket_mode: false,
  weight_sales: false,
  price_by_amount: false,
  wholesale_sales: false,
  product_price_tiers: false,
  fixed_weight_variants: false,
};

export const DEFAULT_BUSINESS_ACTIVITY_SETTINGS = {
  activity_type: "retail" as BusinessActivityType,
  enabled_sales_modes: ["retail"] as SalesMode[],
  default_sales_mode: "retail" as SalesMode,
  enable_weight_sales: false,
  enable_piece_sales: true,
  enable_wholesale_sales: false,
  enable_variants: true,
  enable_price_by_amount: false,
  allow_cashier_wholesale: false,
  require_manager_for_wholesale: true,
  auto_apply_wholesale_by_quantity: false,
  default_inventory_tracking_mode: "standard" as InventoryTrackingMode,
  default_inventory_rotation_method: "FIFO" as InventoryRotationMethod,
  default_expiry_policy: "block_sale" as ExpiryPolicy,
  enable_batch_tracking: false,
  enable_expiry_tracking: false,
  enable_serial_tracking: false,
  expiry_alert_days: [7, 14, 30] as number[],
};

export type BusinessActivitySettings = typeof DEFAULT_BUSINESS_ACTIVITY_SETTINGS;

export const PRODUCT_TEMPLATE_IDS = [
  "retail_product",
  "supermarket_weight_product",
  "restaurant_ingredient",
  "ice_cream_ingredient",
  "packaging_material",
  "service",
] as const;
export type ProductTemplateId = (typeof PRODUCT_TEMPLATE_IDS)[number];

export type ProductTemplate = {
  id: ProductTemplateId;
  label: string;
  product_type: ProductType;
  sales_unit_type: ProductSalesUnitType;
  unit: MeasurementUnit;
  base_unit: MeasurementUnit;
  sale_unit: MeasurementUnit;
  inventory_tracking_mode: InventoryTrackingMode;
  inventory_rotation_method: InventoryRotationMethod;
  expiry_policy: ExpiryPolicy;
  expiry_tracking_enabled: boolean;
  shelf_life_days: number;
  shelf_life_months: number;
  shelf_life_years: number;
  allow_fractional_quantity: boolean;
  allow_price_input: boolean;
  track_inventory: boolean;
  wholesale_enabled: boolean;
};

export type ProductTemplateSettings = Record<ProductTemplateId, ProductTemplate>;

export const ACTIVITY_PRESETS: Record<
  BusinessActivityType,
  Partial<BusinessActivitySettings> & { featureFlags?: Partial<Record<FeatureFlag, boolean>> }
> = {
  cafe: {
    activity_type: "cafe",
    enabled_sales_modes: ["retail"],
    default_sales_mode: "retail",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: false,
    enable_variants: true,
    enable_price_by_amount: false,
    default_inventory_tracking_mode: "standard",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
    featureFlags: { weight_sales: false, wholesale_sales: false, supermarket_mode: false },
  },
  ice_cream: {
    activity_type: "ice_cream",
    enabled_sales_modes: ["retail"],
    default_sales_mode: "retail",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: false,
    enable_variants: true,
    enable_price_by_amount: false,
    default_inventory_tracking_mode: "batch_and_expiry",
    default_inventory_rotation_method: "FEFO",
    default_expiry_policy: "block_sale",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
    featureFlags: { weight_sales: false, wholesale_sales: false, supermarket_mode: false },
  },
  restaurant: {
    activity_type: "restaurant",
    enabled_sales_modes: ["retail"],
    default_sales_mode: "retail",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: false,
    enable_variants: true,
    enable_price_by_amount: false,
    default_inventory_tracking_mode: "batch_and_expiry",
    default_inventory_rotation_method: "FEFO",
    default_expiry_policy: "block_sale",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
    featureFlags: { weight_sales: false, wholesale_sales: false, supermarket_mode: false },
  },
  supermarket: {
    activity_type: "supermarket",
    enabled_sales_modes: ["retail", "wholesale"],
    default_sales_mode: "retail",
    enable_weight_sales: true,
    enable_piece_sales: true,
    enable_wholesale_sales: true,
    enable_variants: true,
    enable_price_by_amount: true,
    allow_cashier_wholesale: true,
    require_manager_for_wholesale: false,
    auto_apply_wholesale_by_quantity: true,
    default_inventory_tracking_mode: "batch_and_expiry",
    default_inventory_rotation_method: "FEFO",
    default_expiry_policy: "block_sale",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
    featureFlags: {
      supermarket_mode: true,
      weight_sales: true,
      price_by_amount: true,
      wholesale_sales: true,
      product_price_tiers: true,
      fixed_weight_variants: true,
      barcode_scanner: true,
    },
  },
  retail: {
    activity_type: "retail",
    enabled_sales_modes: ["retail"],
    default_sales_mode: "retail",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: false,
    enable_variants: true,
    enable_price_by_amount: false,
    default_inventory_tracking_mode: "standard",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: false,
    enable_expiry_tracking: false,
    enable_serial_tracking: true,
    featureFlags: { supermarket_mode: false },
  },
  wholesale: {
    activity_type: "wholesale",
    enabled_sales_modes: ["retail", "wholesale"],
    default_sales_mode: "wholesale",
    enable_weight_sales: true,
    enable_piece_sales: true,
    enable_wholesale_sales: true,
    enable_variants: true,
    enable_price_by_amount: false,
    allow_cashier_wholesale: true,
    auto_apply_wholesale_by_quantity: true,
    default_inventory_tracking_mode: "batch",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: false,
    enable_serial_tracking: true,
    featureFlags: {
      wholesale_sales: true,
      product_price_tiers: true,
      weight_sales: true,
    },
  },
  mixed: {
    activity_type: "mixed",
    enabled_sales_modes: ["retail", "wholesale"],
    default_sales_mode: "retail",
    enable_weight_sales: true,
    enable_piece_sales: true,
    enable_wholesale_sales: true,
    enable_variants: true,
    enable_price_by_amount: true,
    default_inventory_tracking_mode: "standard",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: true,
    featureFlags: {
      weight_sales: true,
      price_by_amount: true,
      wholesale_sales: true,
      product_price_tiers: true,
      fixed_weight_variants: true,
    },
  },
};

export const DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY: Record<
  BusinessActivityType,
  ProductTemplateSettings
> = {
  cafe: {
    retail_product: {
      id: "retail_product",
      label: "Retail Product",
      product_type: "finished_product",
      sales_unit_type: "piece",
      unit: "piece",
      base_unit: "piece",
      sale_unit: "piece",
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: false,
      shelf_life_days: 0,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: false,
      allow_price_input: false,
      track_inventory: true,
      wholesale_enabled: false,
    },
    supermarket_weight_product: {
      id: "supermarket_weight_product",
      label: "Supermarket Weight Product",
      product_type: "finished_product",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_days: 3,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: true,
      allow_price_input: true,
      track_inventory: true,
      wholesale_enabled: false,
    },
    restaurant_ingredient: {
      id: "restaurant_ingredient",
      label: "Restaurant Ingredient",
      product_type: "raw_material",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_days: 7,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: true,
      allow_price_input: false,
      track_inventory: true,
      wholesale_enabled: false,
    },
    ice_cream_ingredient: {
      id: "ice_cream_ingredient",
      label: "Ice Cream Ingredient",
      product_type: "raw_material",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_days: 30,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: true,
      allow_price_input: false,
      track_inventory: true,
      wholesale_enabled: false,
    },
    packaging_material: {
      id: "packaging_material",
      label: "Packaging Material",
      product_type: "packaging_material",
      sales_unit_type: "pack",
      unit: "pack",
      base_unit: "pack",
      sale_unit: "pack",
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: false,
      shelf_life_days: 0,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: false,
      allow_price_input: false,
      track_inventory: true,
      wholesale_enabled: false,
    },
    service: {
      id: "service",
      label: "Service",
      product_type: "service",
      sales_unit_type: "piece",
      unit: "piece",
      base_unit: "piece",
      sale_unit: "piece",
      inventory_tracking_mode: "none",
      inventory_rotation_method: "FIFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: false,
      shelf_life_days: 0,
      shelf_life_months: 0,
      shelf_life_years: 0,
      allow_fractional_quantity: false,
      allow_price_input: false,
      track_inventory: false,
      wholesale_enabled: false,
    },
  },
  ice_cream: {} as ProductTemplateSettings,
  restaurant: {} as ProductTemplateSettings,
  supermarket: {} as ProductTemplateSettings,
  retail: {} as ProductTemplateSettings,
  wholesale: {} as ProductTemplateSettings,
  mixed: {} as ProductTemplateSettings,
};

for (const activity of BUSINESS_ACTIVITY_TYPES) {
  if (activity === "cafe") continue;
  DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY[activity] = structuredClone(
    DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.cafe
  );
}

export const ONLINE_ORDER_SOURCES = ["qr_menu", "souqna"] as const;
export type OnlineOrderSource = (typeof ONLINE_ORDER_SOURCES)[number];
