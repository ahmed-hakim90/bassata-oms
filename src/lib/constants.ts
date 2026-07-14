export const APP_NAME = "Velora";
/** Short product pitch — UI / metadata (Arabic-first ops). */
export const APP_TAGLINE_AR = "نظام كاشير وإدارة فروع";
export const APP_TAGLINE = "POS and branch operations";
export const APP_DESCRIPTION_AR =
  "Velora — نظام كاشير وإدارة فروع للمقاهي والمطاعم والمتاجر: مبيعات، مخزون، مشتريات، وتقارير يومية.";
export const APP_DESCRIPTION =
  "Velora — POS and branch operations for cafés, restaurants, and retail: sales, inventory, purchasing, and daily reports.";
/** Brand primary (light theme action). Used by icons / PWA / theme-color. */
export const APP_THEME_COLOR = "#0e7490";
export const APP_THEME_COLOR_DARK = "#22d3ee";

export const ROLES = ["owner", "manager", "cashier", "inventory"] as const;
export type UserRole = (typeof ROLES)[number];

export const ORDER_STATUSES = ["open", "completed", "voided", "refunded"] as const;
export const SALES_DOCUMENT_STATUSES = ["draft", "issued", "delivered"] as const;
export const ONLINE_ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "cancelled",
  "invoiced",
] as const;
export const PAYMENT_METHODS = ["cash", "card", "wallet", "other", "credit"] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "مالك",
  manager: "مدير",
  cashier: "كاشير",
  inventory: "أمين مخزن",
};
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
  "manage_promotions",
  // Reports
  "reports_view",
  "costs_view",
  "reports_print",
  "reports_export_excel",
  "reports_export_pdf",
  "financial_reports_view",
  "profit_reports_view",
  "customer_statement_view",
  "supplier_statement_view",
  "barcode_label_print",
  // System
  "settings_manage",
  "user_manage",
  "audit_view",
  "imports_exports",
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

/** Must match DB enum `business_activity_type` (no invented values). */
export const BUSINESS_ACTIVITY_TYPES = [
  "cafe",
  "ice_cream",
  "juice_bar",
  "supermarket",
  "restaurant",
  "retail",
  "wholesale",
  "mixed",
] as const;
export type BusinessActivityType = (typeof BUSINESS_ACTIVITY_TYPES)[number];

/** Shared Arabic labels — onboarding + Settings → Activity. */
export const BUSINESS_ACTIVITY_TYPE_LABELS: Record<BusinessActivityType, string> = {
  cafe: "كافيه / تيك أواي",
  ice_cream: "آيس كريم",
  juice_bar: "عصائر",
  supermarket: "سوبر ماركت",
  restaurant: "مطعم",
  retail: "تجزئة",
  wholesale: "جملة",
  mixed: "تجزئة وجملة",
};

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
  "/sales-invoices": "checkout_create",
  "/online-orders": "order_view",
  "/devices": "settings_manage",
  "/inventory/warehouses": "settings_manage",
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
  "/promotions": "manage_promotions",
  "/reports": "reports_view",
  "/reports/sales": "reports_view",
  "/reports/sessions": "reports_view",
  "/reports/daily-close": "reports_view",
  "/reports/aging": "reports_view",
  "/reports/tax": "reports_view",
  "/reports/replenishment": "reports_view",
  "/reports/profit": "profit_reports_view",
  "/reports/inventory": "inventory_view",
  "/reports/product-card": "inventory_view",
  "/reports/expenses": "financial_reports_view",
  "/labels": "barcode_label_print",
  "/settings": [
    "settings_manage",
    "session_settings_manage",
    "user_manage",
    "cost_center_manage",
    "audit_view",
  ],
  "/users": "user_manage",
  "/audit": "audit_view",
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
export const SHELF_LIFE_UNITS = ["days", "months", "years"] as const;
export type ShelfLifeUnit = (typeof SHELF_LIFE_UNITS)[number];

export function canViewCosts(role: UserRole, permissions?: Set<PermissionKey>): boolean {
  return canViewProfitReports(role, permissions);
}

export function canViewProfitReports(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (permissions?.has("profit_reports_view") || permissions?.has("costs_view")) return true;
  return role === "owner" || role === "manager";
}

export function canViewFinancialReports(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (
    permissions?.has("financial_reports_view") ||
    permissions?.has("profit_reports_view") ||
    permissions?.has("costs_view")
  ) {
    return true;
  }
  return role === "owner" || role === "manager";
}

export function canPrintReports(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (permissions?.has("reports_print")) return true;
  return role === "owner" || role === "manager";
}

/** Label Studio + `/print/labels` — independent of `reports_print`. */
export function canPrintBarcodeLabels(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (permissions?.has("barcode_label_print")) return true;
  return role === "owner" || role === "manager" || role === "inventory";
}

export function canExportExcel(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (permissions?.has("reports_export_excel")) return true;
  return role === "owner" || role === "manager";
}

export function canExportPdf(
  role: UserRole,
  permissions?: Set<PermissionKey>
): boolean {
  if (permissions?.has("reports_export_pdf")) return true;
  return role === "owner" || role === "manager";
}

export const NAV_GROUPS = [
  {
    label: "Dashboard",
    items: [
      { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
      { label: "User Guide", href: "/guide", icon: "BookOpen" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "POS", href: "/pos", icon: "ShoppingCart" },
      { label: "POS Devices", href: "/devices", icon: "MonitorSmartphone" },
      { label: "Orders", href: "/orders", icon: "Receipt" },
      { label: "Sales Invoices", href: "/sales-invoices", icon: "Receipt" },
      { label: "Online Orders", href: "/online-orders", icon: "Receipt" },
      { label: "Promotions", href: "/promotions", icon: "Tag" },
      { label: "Sessions", href: "/sessions", icon: "Clock" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", href: "/products", icon: "Package" },
      { label: "Stock", href: "/inventory", icon: "Warehouse" },
      { label: "Warehouses", href: "/inventory/warehouses", icon: "Warehouse" },
      { label: "Purchases", href: "/inventory/purchases", icon: "Truck" },
      { label: "Transfers", href: "/inventory/transfers", icon: "ArrowLeftRight" },
      { label: "Waste", href: "/inventory/waste", icon: "Trash2" },
      { label: "Stock Count", href: "/inventory/stock-count", icon: "ClipboardList" },
      { label: "Product Card", href: "/reports/product-card", icon: "ClipboardList" },
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
    label: "Accounting",
    items: [
      { label: "Expenses", href: "/expenses", icon: "Wallet" },
      { label: "Suppliers", href: "/inventory/suppliers", icon: "Building2" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Overview", href: "/reports", icon: "BarChart3" },
      { label: "Sales", href: "/reports/sales", icon: "TrendingUp" },
      { label: "Sessions", href: "/reports/sessions", icon: "Clock" },
      { label: "Profit", href: "/reports/profit", icon: "CircleDollarSign" },
      { label: "Inventory", href: "/reports/inventory", icon: "Warehouse" },
      { label: "Product Card", href: "/reports/product-card", icon: "ClipboardList" },
      { label: "Expenses", href: "/reports/expenses", icon: "Wallet" },
      { label: "Barcode Labels", href: "/labels", icon: "Barcode" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/users", icon: "Shield" },
      { label: "Settings", href: "/settings", icon: "Settings" },
      { label: "Audit Logs", href: "/audit", icon: "ScrollText" },
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
  "promotions",
  "reports",
  "imports_exports",
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
] as const;
/**
 * Canonical editable/enforced flags (Settings + requireFeature).
 * Not included (intentional):
 * - online_menu / online_orders — stripped in cleanup; use store settings
 * - monthly_closing — Future (period lock); orphan rows may linger in JSON
 * - supermarket_mode / weight_sales / price_by_amount / wholesale_sales /
 *   product_price_tiers / fixed_weight_variants — legacy; use business_activity
 */

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
  promotions: false,
  reports: true,
  imports_exports: true,
  cash_drawer: false,
  dark_mode: true,
  tax: true,
  payment_cash: true,
  payment_card: true,
  payment_wallet: true,
  payment_other: true,
  prevent_negative_stock: false,
  session_expenses: true,
  refunds: false,
  stock_count: true,
  transfers: true,
  purchases: true,
  waste: true,
  recipes: true,
  credit_sales: false,
};

export const DEFAULT_BUSINESS_ACTIVITY_SETTINGS = {
  activity_type: "cafe" as BusinessActivityType,
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
  default_expiry_policy: "warn_only" as ExpiryPolicy,
  enable_batch_tracking: true,
  enable_expiry_tracking: true,
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
  shelf_life_value: number;
  shelf_life_unit: ShelfLifeUnit;
  allow_fractional_quantity: boolean;
  allow_price_input: boolean;
  track_inventory: boolean;
  wholesale_enabled: boolean;
};

export type ProductTemplateSettings = Record<ProductTemplateId, ProductTemplate>;

function productTemplate(
  id: ProductTemplateId,
  label: string,
  overrides: Partial<Omit<ProductTemplate, "id" | "label">> = {}
): ProductTemplate {
  return {
    id,
    label,
    product_type: "finished_product",
    sales_unit_type: "piece",
    unit: "piece",
    base_unit: "piece",
    sale_unit: "piece",
    inventory_tracking_mode: "standard",
    inventory_rotation_method: "FIFO",
    expiry_policy: "warn_only",
    expiry_tracking_enabled: false,
    shelf_life_value: 0,
    shelf_life_unit: "days",
    allow_fractional_quantity: false,
    allow_price_input: false,
    track_inventory: true,
    wholesale_enabled: false,
    ...overrides,
  };
}

function productTemplateSet(
  overrides: Partial<Record<ProductTemplateId, Partial<Omit<ProductTemplate, "id" | "label">>>> = {}
): ProductTemplateSettings {
  return {
    retail_product: productTemplate("retail_product", "Retail Product", overrides.retail_product),
    supermarket_weight_product: productTemplate(
      "supermarket_weight_product",
      "Supermarket Weight Product",
      {
        sales_unit_type: "weight",
        unit: "kg",
        base_unit: "kg",
        sale_unit: "kg",
        inventory_tracking_mode: "batch_and_expiry",
        inventory_rotation_method: "FEFO",
        expiry_policy: "block_sale",
        expiry_tracking_enabled: true,
        shelf_life_value: 3,
        allow_fractional_quantity: true,
        allow_price_input: true,
        ...overrides.supermarket_weight_product,
      }
    ),
    restaurant_ingredient: productTemplate("restaurant_ingredient", "Restaurant Ingredient", {
      product_type: "raw_material",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_value: 7,
      allow_fractional_quantity: true,
      ...overrides.restaurant_ingredient,
    }),
    ice_cream_ingredient: productTemplate("ice_cream_ingredient", "Ice Cream Ingredient", {
      product_type: "raw_material",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_value: 30,
      allow_fractional_quantity: true,
      ...overrides.ice_cream_ingredient,
    }),
    packaging_material: productTemplate("packaging_material", "Packaging Material", {
      product_type: "packaging_material",
      sales_unit_type: "pack",
      unit: "pack",
      base_unit: "pack",
      sale_unit: "pack",
      ...overrides.packaging_material,
    }),
    service: productTemplate("service", "Service", {
      product_type: "service",
      inventory_tracking_mode: "none",
      track_inventory: false,
      ...overrides.service,
    }),
  };
}

/**
 * Default business_activity settings per activity type.
 * Sales modes, weight/wholesale, variants, inventory policies only.
 * Managed feature flags (recipes, credit_sales, barcode, …) live exclusively in
 * `buildBusinessActivityFeatureFlags` — do not add feature toggles here.
 */
export const ACTIVITY_PRESETS: Record<BusinessActivityType, Partial<BusinessActivitySettings>> = {
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
  },
  juice_bar: {
    activity_type: "juice_bar",
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
  },
  supermarket: {
    activity_type: "supermarket",
    enabled_sales_modes: ["retail"],
    default_sales_mode: "retail",
    enable_weight_sales: true,
    enable_piece_sales: true,
    enable_wholesale_sales: false,
    enable_variants: false,
    enable_price_by_amount: true,
    default_inventory_tracking_mode: "batch_and_expiry",
    default_inventory_rotation_method: "FEFO",
    default_expiry_policy: "block_sale",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
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
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
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
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
  },
  wholesale: {
    activity_type: "wholesale",
    enabled_sales_modes: ["wholesale"],
    default_sales_mode: "wholesale",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: true,
    enable_variants: true,
    enable_price_by_amount: false,
    allow_cashier_wholesale: true,
    require_manager_for_wholesale: false,
    auto_apply_wholesale_by_quantity: true,
    default_inventory_tracking_mode: "standard",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: false,
    enable_serial_tracking: false,
  },
  mixed: {
    activity_type: "mixed",
    enabled_sales_modes: ["retail", "wholesale"],
    default_sales_mode: "retail",
    enable_weight_sales: false,
    enable_piece_sales: true,
    enable_wholesale_sales: true,
    enable_variants: true,
    enable_price_by_amount: false,
    allow_cashier_wholesale: false,
    require_manager_for_wholesale: true,
    auto_apply_wholesale_by_quantity: false,
    default_inventory_tracking_mode: "standard",
    default_inventory_rotation_method: "FIFO",
    default_expiry_policy: "warn_only",
    enable_batch_tracking: true,
    enable_expiry_tracking: true,
    enable_serial_tracking: false,
  },
};

export const DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY: Record<
  BusinessActivityType,
  ProductTemplateSettings
> = {
  cafe: productTemplateSet({
    retail_product: {
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 2,
    },
    supermarket_weight_product: {
      shelf_life_value: 2,
      allow_price_input: false,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  ice_cream: productTemplateSet({
    retail_product: {
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: true,
      shelf_life_value: 14,
    },
    supermarket_weight_product: {
      shelf_life_value: 30,
      allow_price_input: false,
    },
    restaurant_ingredient: {
      shelf_life_value: 30,
    },
    ice_cream_ingredient: {
      shelf_life_value: 90,
      shelf_life_unit: "days",
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  juice_bar: productTemplateSet({
    retail_product: {
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 1,
    },
    supermarket_weight_product: {
      shelf_life_value: 1,
      allow_price_input: false,
    },
    restaurant_ingredient: {
      shelf_life_value: 5,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  supermarket: productTemplateSet({
    retail_product: {
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 30,
    },
    supermarket_weight_product: {
      shelf_life_value: 7,
      allow_price_input: true,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  restaurant: productTemplateSet({
    retail_product: {
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 1,
    },
    supermarket_weight_product: {
      shelf_life_value: 2,
      allow_price_input: false,
    },
    restaurant_ingredient: {
      shelf_life_value: 5,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  retail: productTemplateSet({
    retail_product: {
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 30,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  wholesale: productTemplateSet({
    retail_product: {
      wholesale_enabled: true,
      expiry_tracking_enabled: false,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
  mixed: productTemplateSet({
    retail_product: {
      wholesale_enabled: true,
      expiry_policy: "warn_only",
      expiry_tracking_enabled: true,
      shelf_life_value: 30,
    },
    packaging_material: {
      inventory_tracking_mode: "standard",
    },
  }),
};
