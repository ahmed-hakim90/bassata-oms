import { NAV_GROUPS, PATH_PERMISSIONS } from "@/lib/constants";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";

const FEATURE_BY_PATH: Partial<Record<string, FeatureFlag>> = {
  "/reports": "reports",
  "/imports-exports": "imports_exports",
  "/monthly-closing": "monthly_closing",
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
    "/settings/cost-centers",
    "/audit",
    "/imports-exports",
    "/monthly-closing",
  ]);
  const CASHIER_HIDDEN = new Set([
    "/users",
    "/settings",
    "/settings/cost-centers",
    "/audit",
    "/imports-exports",
    "/monthly-closing",
    "/reports",
    "/products",
    "/inventory",
    "/inventory/purchases",
    "/inventory/suppliers",
    "/inventory/transfers",
    "/inventory/waste",
    "/inventory/stock-count",
    "/customers",
    "/customers/loyalty",
  ]);
  return (href: string) => {
    if (role === "owner" || role === "manager") return true;
    if (role === "viewer") return href === "/" || href === "/reports" || href === "/orders";
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

/** @deprecated use filterNavByAccess */
export function filterNavByRole(
  role: UserRole,
  flags?: Partial<Record<FeatureFlag, boolean>>
) {
  return filterNavByAccess(role, new Set(), flags);
}
