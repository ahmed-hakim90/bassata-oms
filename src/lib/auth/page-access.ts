import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { filterNavByAccess, navItemAllowed, type NavAccessOptions } from "@/lib/auth/nav";
import { permissionAllowsPath } from "@/lib/repositories/permission.repository";

export interface PageAccessDenial {
  title: string;
  description: string;
}

const PATH_LABELS: Record<string, string> = {
  "/settings": "الإعدادات",
  "/admin": "الإدارة",
  "/users": "الإعدادات",
  "/audit": "الإعدادات",
  "/operations": "التشغيل",
  "/sales-documents": "مستندات البيع",
  "/catalog": "المنتجات",
  "/purchasing": "المشتريات",
  "/reports": "التقارير",
  "/expenses": "إدارة المصروفات",
  "/reports/expenses": "تقرير المصروفات",
  "/reports/sales": "تقرير المبيعات",
  "/reports/sales/product": "مبيعات منتج",
  "/reports/sales/branch": "ملخص فرع",
  "/reports/sales/cashier": "ملخص موظف",
  "/reports/sessions": "تقرير الجلسات",
  "/reports/profit": "تقرير الربح",
  "/reports/inventory": "تقرير المخزون",
  "/reports/daily-close": "تقرير الإقفال اليومي",
  "/reports/aging": "مديونية العملاء والموردين",
  "/reports/statement": "كشف حساب عميل / مورد",
  "/reports/tax": "تقرير الضريبة",
  "/reports/replenishment": "تقرير إعادة الطلب",
  "/reports/product-card": "كارت صنف",
  "/orders": "الطلبات",
  "/kitchen": "شاشة المطبخ",
  "/quotations": "عروض الأسعار",
  "/sales-orders": "أوامر البيع",
  "/sales-invoices": "فواتير المبيعات",
  "/credit-notes": "إشعارات دائنة",
  "/sessions": "ورديات الكاشير",
  "/inventory/stock-count": "جرد المخزون",
  "/inventory": "المخزون",
  "/inventory/purchases": "المشتريات",
  "/inventory/purchase-requests": "طلبات الشراء",
  "/inventory/purchase-orders": "أوامر التوريد",
  "/inventory/purchase-returns": "مرتجعات المشتريات",
  "/inventory/containers": "الحاويات",
  "/inventory/customs-certificates": "الشهادات الجمركية",
  "/products": "المنتجات",
  "/customers": "العملاء",
  "/customers/directory": "دليل العملاء",
  "/promotions": "العروض",
  "/accounting": "الحسابات",
  "/accounting/accounts": "دليل الحسابات",
  "/treasury": "الخزائن",
  "/purchases": "المشتريات",
  "/devices": "الأجهزة",
  "/inventory/movements": "سجل حركة المخزون",
};

function isSalesDocumentsPath(pathname: string): boolean {
  return (
    pathname === "/sales-documents" ||
    pathname.startsWith("/sales-documents/") ||
    pathname === "/sales-invoices" ||
    pathname.startsWith("/sales-invoices/") ||
    pathname === "/quotations" ||
    pathname.startsWith("/quotations/") ||
    pathname === "/sales-orders" ||
    pathname.startsWith("/sales-orders/") ||
    pathname === "/credit-notes" ||
    pathname.startsWith("/credit-notes/")
  );
}

function isKitchenPath(pathname: string): boolean {
  return pathname === "/kitchen" || pathname.startsWith("/kitchen/");
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

  if (isSalesDocumentsPath(pathname)) {
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

  if (isKitchenPath(pathname) && options?.enableKitchenDisplay === false) {
    return {
      title: "شاشة المطبخ",
      description:
        "شاشة المطبخ للمطاعم والكافيهات والأنشطة اللي فيها تحضير — مش متاحة لنوع النشاط الحالي.",
    };
  }

  if (navAllowsPath(role, pathname, permissions, flags, options)) return null;

  // Sidebar matching misses real screens like /account and /devices.
  // navItemAllowed still honors feature flags, role legacy, and PATH_PERMISSIONS.
  if (navItemAllowed(pathname, role, permissions, flags, options)) return null;

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
