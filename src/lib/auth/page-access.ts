import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { filterNavByAccess, type NavAccessOptions } from "@/lib/auth/nav";
import { permissionAllowsPath } from "@/lib/repositories/permission.repository";

export interface PageAccessDenial {
  title: string;
  description: string;
}

const PATH_LABELS: Record<string, string> = {
  "/settings": "الإعدادات",
  "/users": "الإعدادات",
  "/audit": "الإعدادات",
  "/reports": "التقارير",
  "/expenses": "المصروفات",
  "/orders": "الطلبات",
  "/sales-invoices": "فواتير المبيعات",
  "/sessions": "الجلسات",
  "/inventory": "المخزون",
  "/products": "المنتجات",
  "/customers": "العملاء",
  "/promotions": "العروض",
  "/purchases": "المشتريات",
};

function isSalesInvoicesPath(pathname: string): boolean {
  return pathname === "/sales-invoices" || pathname.startsWith("/sales-invoices/");
}

function navAllowsPath(
  role: UserRole,
  pathname: string,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
): boolean {
  const groups = filterNavByAccess(role, permissions, flags, options);
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
  permissions: Set<PermissionKey> = new Set(),
  options?: NavAccessOptions
): PageAccessDenial | null {
  if (pathname === "/" || pathname === "/login") return null;

  if (isSalesInvoicesPath(pathname)) {
    if (options?.enableWholesaleSales === false) {
      return {
        title: "فواتير المبيعات",
        description: "بيع الجملة غير مفعّل — فعّله من إعدادات النشاط عشان تفتح الصفحة دي.",
      };
    }
    if (role === "cashier" && options?.allowCashierWholesale === false) {
      return {
        title: "فواتير المبيعات",
        description: "الكاشير غير مسموح له ببيع الجملة — فعّل الصلاحية من إعدادات النشاط.",
      };
    }
  }

  if (navAllowsPath(role, pathname, permissions, flags, options)) return null;

  if (role !== "owner" && permissionAllowsPath(pathname, permissions)) return null;

  const label =
    Object.entries(PATH_LABELS).find(([p]) => pathname.startsWith(p))?.[1] ??
    "الصفحة دي";

  if (role === "cashier") {
    return {
      title: "مفيش صلاحية",
      description: `حساب الكاشير مش هيقدر يفتح ${label}. لو محتاج حاجة، كلّم المدير.`,
    };
  }

  if (role === "inventory") {
    return {
      title: "مفيش صلاحية",
      description: `حساب المخزن مش هيقدر يفتح ${label}. استخدم المنتجات والمخزون من القائمة.`,
    };
  }

  return {
    title: "مفيش صلاحية",
    description: `مش عندك صلاحية تفتح ${label}.`,
  };
}
