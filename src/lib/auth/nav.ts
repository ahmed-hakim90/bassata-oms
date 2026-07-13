import { NAV_GROUPS, PATH_PERMISSIONS } from "@/lib/constants";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";

/**
 * Nav href → feature flag. Keep in sync with modules that have a sidebar entry
 * and are toggled from Settings → Features / POS.
 * Online orders stay store-settings gated (not feature_flags).
 * `/labels` uses `barcode_label_print` permission — not `barcode_scanner` (POS field).
 */
const FEATURE_BY_PATH: Partial<Record<string, FeatureFlag>> = {
  "/reports": "reports",
  "/reports/sales": "reports",
  "/reports/sessions": "reports",
  "/reports/profit": "reports",
  "/reports/inventory": "reports",
  "/reports/expenses": "reports",
  "/inventory/purchases": "purchases",
  "/inventory/suppliers": "purchases",
  "/inventory/transfers": "transfers",
  "/inventory/waste": "waste",
  "/inventory/stock-count": "stock_count",
  "/customers/loyalty": "loyalty",
  "/expenses": "session_expenses",
};

function pathAllowedByPermission(href: string, permissions: Set<PermissionKey>): boolean {
  const required = PATH_PERMISSIONS[href];
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
    "/inventory/warehouses",
  ]);
  const CASHIER_HIDDEN = new Set([
    "/users",
    "/settings",
    "/audit",
    "/reports",
    "/reports/sales",
    "/reports/sessions",
    "/reports/profit",
    "/reports/inventory",
    "/reports/expenses",
    "/labels",
    "/products",
    "/inventory",
    "/inventory/purchases",
    "/inventory/suppliers",
    "/inventory/transfers",
    "/inventory/waste",
    "/inventory/stock-count",
    "/inventory/warehouses",
    "/devices",
    "/customers",
    "/customers/loyalty",
    "/expenses",
  ]);
  return (href: string) => {
    if (role === "owner" || role === "manager") return true;
    if (role === "cashier") return !CASHIER_HIDDEN.has(href);
    if (role === "inventory") {
      return (
        href === "/" ||
        href === "/products" ||
        href === "/inventory" ||
        href.startsWith("/inventory/")
      );
    }
    if (PRIVILEGED_ONLY.has(href)) return false;
    return true;
  };
}

export function filterNavByAccess(
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>
) {
  const useLegacy = permissions.size === 0;
  const legacyAllow = useLegacy ? filterNavByRoleLegacy(role) : null;

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const flag = FEATURE_BY_PATH[item.href];
      if (flag && flags?.[flag] === false) return false;
      if (role === "owner") return true;
      if (useLegacy && legacyAllow) return legacyAllow(item.href);
      return pathAllowedByPermission(item.href, permissions);
    }),
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
  flags?: Partial<Record<FeatureFlag, boolean>>
) {
  return filterNavByAccess(role, new Set(), flags);
}
