import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { filterNavByAccess } from "@/lib/auth/nav";
import { permissionAllowsPath } from "@/lib/repositories/permission.repository";

export interface PageAccessDenial {
  title: string;
  description: string;
}

const PATH_LABELS: Record<string, string> = {
  "/settings": "Settings",
  "/settings/cost-centers": "Settings",
  "/users": "Settings",
  "/audit": "Settings",
  "/reports": "Reports",
  "/imports-exports": "Imports & Exports",
  "/monthly-closing": "Monthly Closing",
  "/expenses": "Expenses",
};

function navAllowsPath(
  role: UserRole,
  pathname: string,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>
): boolean {
  const groups = filterNavByAccess(role, permissions, flags);
  return groups.some((g) =>
    g.items.some(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(`${item.href}/`))
    )
  );
}

export function getPageAccessDenial(
  pathname: string,
  role: UserRole,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  permissions: Set<PermissionKey> = new Set()
): PageAccessDenial | null {
  if (pathname === "/" || pathname === "/login") return null;

  if (navAllowsPath(role, pathname, permissions, flags)) return null;

  if (role !== "owner" && permissionAllowsPath(pathname, permissions)) return null;

  const label =
    Object.entries(PATH_LABELS).find(([p]) => pathname.startsWith(p))?.[1] ??
    "this page";

  if (role === "cashier") {
    return {
      title: "Access denied",
      description: `Your cashier account cannot open ${label}. Ask a manager if you need help.`,
    };
  }

  if (role === "viewer") {
    return {
      title: "Read-only access",
      description: `Your viewer account cannot open ${label}.`,
    };
  }

  if (role === "inventory") {
    return {
      title: "Access denied",
      description: `Inventory staff cannot open ${label}. Use Products and Inventory from the menu.`,
    };
  }

  return {
    title: "Access denied",
    description: `You do not have permission to open ${label}.`,
  };
}
