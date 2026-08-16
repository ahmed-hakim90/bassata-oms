import { NAV_GROUPS, PATH_PERMISSIONS } from "@/lib/constants";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";

/** Activity-driven nav gates (not feature_flags). */
export type NavAccessOptions = {
  /** When false, hide /sales-invoices. Omit to leave unchanged (tests / legacy). */
  enableWholesaleSales?: boolean;
  /** When false, hide /sales-invoices for cashiers. */
  allowCashierWholesale?: boolean;
  /** When false, hide /kitchen (food-service activities only). */
  enableKitchenDisplay?: boolean;
};

/**
 * Nav href → feature flag. Keep in sync with modules that have a sidebar entry
 * and are toggled from Settings → Features / POS.
 * Online orders stay store-settings gated (not feature_flags).
 * `/labels` uses `barcode_label_print` permission — not `barcode_scanner` (POS field).
 */
const FEATURE_BY_PATH: Partial<Record<string, FeatureFlag>> = {
  "/reports": "reports",
  "/reports/sales": "reports",
  "/reports/sales/product": "reports",
  "/reports/sales/branch": "reports",
  "/reports/sales/cashier": "reports",
  "/reports/sessions": "reports",
  "/reports/daily-close": "reports",
  "/reports/aging": "reports",
  "/reports/statement": "reports",
  "/reports/tax": "reports",
  "/reports/replenishment": "reports",
  "/reports/cashiers": "reports",
  "/reports/branches": "reports",
  "/reports/periods": "reports",
  "/reports/heatmap": "reports",
  "/reports/profit": "reports",
  "/reports/margins": "reports",
  "/reports/pnl": "reports",
  "/reports/inventory": "reports",
  "/reports/product-card": "reports",
  "/reports/expenses": "reports",
  "/monthly-closing": "monthly_closing",
  "/inventory/purchases": "purchases",
  "/inventory/purchases/price-list": "purchases",
  "/inventory/purchase-requests": "purchases",
  "/inventory/purchase-orders": "purchases",
  "/inventory/purchase-returns": "purchases",
  "/inventory/suppliers": "purchases",
  "/inventory/containers": "purchase_imports",
  "/inventory/customs-certificates": "purchase_imports",
  "/purchasing": "purchases",
  "/inventory/transfers": "transfers",
  "/inventory/waste": "waste",
  "/inventory/stock-count": "stock_count",
  "/customers/loyalty": "loyalty",
  "/promotions": "promotions",
  "/expenses": "session_expenses",
  "/accounting": "general_ledger",
  "/accounting/accounts": "general_ledger",
  "/accounting/journals": "general_ledger",
  "/accounting/trial-balance": "general_ledger",
  "/accounting/ledger": "general_ledger",
  "/accounting/income-statement": "general_ledger",
  "/accounting/balance-sheet": "general_ledger",
};

function navHrefPath(href: string): string {
  const q = href.indexOf("?");
  return q === -1 ? href : href.slice(0, q);
}

function pathAllowedByPermission(href: string, permissions: Set<PermissionKey>): boolean {
  const required = PATH_PERMISSIONS[navHrefPath(href)];
  if (!required) return true;
  if (Array.isArray(required)) return required.some((k) => permissions.has(k));
  return permissions.has(required);
}

/** Legacy role filter — used when permissions set is empty (pre-migration). */
function filterNavByRoleLegacy(role: UserRole) {
  const PRIVILEGED_ONLY = new Set([
    "/users",
    "/settings",
    "/audit",
    "/devices",
    "/admin",
    "/inventory/warehouses",
    "/monthly-closing",
  ]);
  const CASHIER_HIDDEN = new Set([
    "/users",
    "/settings",
    "/audit",
    "/admin",
    "/catalog",
    "/purchasing",
    "/monthly-closing",
    "/reports",
    "/reports/sales",
    "/reports/sales/product",
    "/reports/sales/branch",
    "/reports/sales/cashier",
    "/reports/sessions",
    "/reports/daily-close",
    "/reports/aging",
    "/reports/statement",
    "/reports/tax",
    "/reports/replenishment",
    "/reports/cashiers",
    "/reports/branches",
    "/reports/periods",
    "/reports/heatmap",
    "/reports/profit",
    "/reports/margins",
    "/reports/pnl",
    "/reports/inventory",
    "/reports/product-card",
    "/reports/expenses",
    "/labels",
    "/products",
    "/inventory",
    "/inventory/purchases",
    "/inventory/purchase-requests",
    "/inventory/purchase-orders",
    "/inventory/purchase-returns",
    "/inventory/suppliers",
    "/inventory/transfers",
    "/inventory/waste",
    "/inventory/stock-count",
    "/inventory/warehouses",
    "/inventory/movements",
    "/devices",
    "/customers",
    "/customers/directory",
    "/customers/loyalty",
    "/promotions",
    "/expenses",
    "/accounting",
    "/accounting/accounts",
    "/accounting/journals",
    "/accounting/trial-balance",
    "/accounting/ledger",
    "/accounting/income-statement",
    "/accounting/balance-sheet",
  ]);
  return (href: string) => {
    if (role === "owner" || role === "manager") return true;
    if (role === "cashier") return !CASHIER_HIDDEN.has(href);
    if (role === "inventory") {
      return (
        href === "/" ||
        href === "/products" ||
        href === "/catalog" ||
        href === "/purchasing" ||
        href === "/inventory" ||
        href.startsWith("/inventory/") ||
        href === "/reports/product-card"
      );
    }
    if (PRIVILEGED_ONLY.has(href)) return false;
    return true;
  };
}

export function navItemAllowed(
  href: string,
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
): boolean {
  const path = navHrefPath(href);
  const flag = FEATURE_BY_PATH[path];
  if (flag && flags?.[flag] === false) return false;
  if (
    path === "/sales-documents" ||
    path === "/sales-invoices" ||
    path === "/quotations" ||
    path === "/sales-orders" ||
    path === "/credit-notes"
  ) {
    if (options?.enableWholesaleSales === false) return false;
    if (role === "cashier" && options?.allowCashierWholesale === false) {
      return false;
    }
  }
  if (path === "/kitchen" && options?.enableKitchenDisplay === false) {
    return false;
  }
  if (role === "owner") return true;
  if (permissions.size === 0) return filterNavByRoleLegacy(role)(path);
  return pathAllowedByPermission(path, permissions);
}

export function filterNavByAccess(
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      navItemAllowed(item.href, role, permissions, flags, options)
    ),
  })).filter((g) => g.items.length > 0);
}

/** Prefer the most specific matching nav href (e.g. /customers/loyalty over /customers). */
export function isNavHrefActive(
  pathname: string,
  href: string,
  siblingHrefs: readonly string[]
): boolean {
  if (href === "/") return pathname === "/";
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
}

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  owner: "المالك",
  manager: "المدير",
  cashier: "الكاشير",
  inventory: "أمين المخزن",
};

/** @deprecated use filterNavByAccess */
export function filterNavByRole(
  role: UserRole,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
) {
  return filterNavByAccess(role, new Set(), flags, options);
}
