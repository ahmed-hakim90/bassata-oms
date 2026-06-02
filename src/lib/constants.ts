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
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

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

export const PRODUCT_TYPES = ["finished", "ingredient"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MEASUREMENT_UNITS = [
  "piece",
  "bag",
  "cup",
  "spoon",
  "gram",
  "kg",
  "ml",
  "liter",
] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

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
};

export const ONLINE_ORDER_SOURCES = ["qr_menu", "souqna"] as const;
export type OnlineOrderSource = (typeof ONLINE_ORDER_SOURCES)[number];
