import {
  filterNavByAccess,
  navItemAllowed,
  type NavAccessOptions,
} from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { allReportHubLinks } from "@/modules/reports/lib/report-hub-links";
import { getVisibleSettingsTabs } from "@/modules/system/components/settings/settings-tabs";

export type CommandPaletteItem = {
  href: string;
  label: string;
  icon: string;
  keywords: string[];
};

export type CommandPaletteGroup = {
  label: string;
  items: CommandPaletteItem[];
};

type ExtraDestination = CommandPaletteItem & {
  group: string;
  accessHref?: string;
  requiresCreditSales?: boolean;
  requiresWholesale?: boolean;
};

const NAV_KEYWORDS: Record<string, string[]> = {
  "/": ["رئيسية", "لوحة", "home"],
  "/operations": ["تشغيل", "لوحة تشغيل", "operations"],
  "/guide": ["دليل", "مساعدة", "help"],
  "/pos": ["كاشير", "بيع", "نقطة البيع"],
  "/kitchen": ["مطبخ", "تحضير", "KDS"],
  "/orders": ["طلبات", "أوردر"],
  "/sales-documents": ["مستندات", "جملة", "لوحة بيع"],
  "/quotations": ["عرض سعر", "عروض الأسعار"],
  "/sales-orders": ["أمر بيع", "أوامر البيع"],
  "/sales-invoices": ["فاتورة", "جملة", "فواتير المبيعات"],
  "/credit-notes": ["إشعار", "مرتجع بيع"],
  "/online-orders": ["أونلاين", "منيو", "توصيل"],
  "/sessions": ["وردية", "درج", "جلسة"],
  "/promotions": ["خصم", "عرض"],
  "/catalog": ["كتالوج", "لوحة منتجات"],
  "/products": ["أصناف", "كتالوج", "منتجات"],
  "/inventory": ["رصيد", "مخزن"],
  "/inventory/warehouses": ["مخازن"],
  "/purchasing": ["مشتريات", "لوحة مشتريات"],
  "/inventory/purchase-requests": ["طلب شراء"],
  "/inventory/purchase-orders": ["أمر توريد", "PO"],
  "/inventory/purchases": ["فاتورة شراء", "مورد"],
  "/inventory/containers": ["حاوية", "حاويات", "شحن"],
  "/inventory/customs-certificates": ["شهادة جمركية", "جمارك", "مينا"],
  "/inventory/purchase-returns": ["مرتجع شراء"],
  "/inventory/suppliers": ["موردين", "دفعة"],
  "/inventory/transfers": ["تحويل", "نقل"],
  "/inventory/waste": ["تالف", "فاقد"],
  "/inventory/stock-count": ["جرد", "تسوية"],
  "/customers": ["عميل", "لوحة عملاء"],
  "/customers/directory": ["دليل", "قائمة عملاء"],
  "/customers/loyalty": ["نقاط", "ولاء"],
  "/accounting": ["حسابات", "لوحة حسابات"],
  "/accounting/accounts": ["شجرة", "دليل حسابات"],
  "/accounting/journals": ["قيد", "يومي"],
  "/accounting/trial-balance": ["ميزان"],
  "/accounting/ledger": ["أستاذ"],
  "/accounting/income-statement": ["قائمة الدخل", "ربح"],
  "/accounting/balance-sheet": ["ميزانية"],
  "/treasury": ["خزينة", "خزائن", "نقد", "صندوق"],
  "/expenses": ["مصروف"],
  "/monthly-closing": ["إقفال", "فترة"],
  "/reports": ["تقارير"],
  "/reports/aging": ["مديونية", "ذمم", "عملاء", "موردين"],
  "/reports/statement": ["كشف حساب", "حركة", "عميل", "مورد"],
  "/labels": ["باركود", "ملصق"],
  "/admin": ["إدارة", "لوحة إدارة"],
  "/users": ["مستخدمين", "صلاحيات"],
  "/devices": ["أجهزة", "كاشير", "pairing", "جهاز"],
  "/settings": ["إعدادات"],
  "/audit": ["مراجعة", "سجل"],
};

const EXTRA_DESTINATIONS: ExtraDestination[] = [
  {
    group: "Inventory",
    href: "/inventory/movements",
    label: "Stock Movements",
    icon: "ClipboardList",
    keywords: ["حركة", "سجل", "timeline", "movements"],
  },
  {
    group: "Purchasing",
    href: "/inventory/purchases/price-list",
    accessHref: "/inventory/purchases",
    label: "Purchase Price List",
    icon: "Tag",
    keywords: ["أسعار", "قائمة أسعار", "شراء"],
  },
  {
    group: "Purchasing",
    href: "/inventory/containers",
    label: "الحاويات",
    icon: "Package",
    keywords: ["حاوية", "حاويات", "شحن", "استيراد"],
  },
  {
    group: "Purchasing",
    href: "/inventory/customs-certificates",
    label: "الشهادات الجمركية",
    icon: "FileBadge",
    keywords: ["شهادة", "جمارك", "مينا", "استيراد"],
  },
  {
    group: "Sales Documents",
    href: "/sales-invoices?create=1",
    accessHref: "/sales-invoices",
    label: "New Sales Invoice",
    icon: "Receipt",
    keywords: ["فاتورة بيع", "جملة", "إنشاء"],
    requiresWholesale: true,
  },
  {
    group: "Sales Documents",
    href: "/quotations?create=1",
    accessHref: "/quotations",
    label: "New Quotation",
    icon: "FileSpreadsheet",
    keywords: ["عرض سعر", "إنشاء"],
    requiresWholesale: true,
  },
  {
    group: "Inventory",
    href: "/inventory/purchase-requests?create=1",
    accessHref: "/inventory/purchase-requests",
    label: "New Purchase Request",
    icon: "ClipboardList",
    keywords: ["طلب شراء", "إنشاء"],
  },
  {
    group: "Administration",
    href: "/settings?tab=print",
    accessHref: "/settings",
    label: "Print Engine",
    icon: "FileSpreadsheet",
    keywords: ["محرك الطباعة", "قالب فاتورة", "تخصيص طباعة", "A4"],
  },
  {
    group: "Administration",
    href: "/account",
    label: "Account",
    icon: "Users",
    keywords: ["حساب", "كلمة مرور", "password", "profile"],
  },
];

function hubAccessHref(href: string): string {
  const path = href.split("?")[0] ?? href;
  if (path === "/reports/aging") return "/reports/aging";
  return path;
}

function pushItem(
  grouped: Map<string, CommandPaletteItem[]>,
  group: string,
  item: CommandPaletteItem
) {
  const items = grouped.get(group) ?? [];
  items.push(item);
  grouped.set(group, items);
}

export function getCommandPaletteGroups(
  role: UserRole,
  permissions: Set<PermissionKey>,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  options?: NavAccessOptions
): CommandPaletteGroup[] {
  const navGroups = filterNavByAccess(role, permissions, flags, options);
  const existingHrefs = new Set<string>(
    navGroups.flatMap((group) => group.items.map((item) => item.href))
  );
  const grouped = new Map<string, CommandPaletteItem[]>();

  for (const group of navGroups) {
    grouped.set(
      group.label,
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
        keywords: NAV_KEYWORDS[item.href] ?? [],
      }))
    );
  }

  for (const link of allReportHubLinks()) {
    if (existingHrefs.has(link.href)) continue;
    if (link.requiresCreditSales && flags?.credit_sales === false) continue;
    if (!navItemAllowed(hubAccessHref(link.href), role, permissions, flags, options)) {
      continue;
    }
    pushItem(grouped, "Reports", {
      href: link.href,
      label: link.label,
      icon: link.icon,
      keywords: [link.description],
    });
  }

  for (const extra of EXTRA_DESTINATIONS) {
    if (existingHrefs.has(extra.href)) continue;
    if (extra.requiresCreditSales && flags?.credit_sales === false) continue;
    if (extra.requiresWholesale && options?.enableWholesaleSales !== true) continue;
    if (!navItemAllowed(extra.accessHref ?? extra.href, role, permissions, flags, options)) {
      continue;
    }
    pushItem(grouped, extra.group, {
      href: extra.href,
      label: extra.label,
      icon: extra.icon,
      keywords: extra.keywords,
    });
  }

  if (navItemAllowed("/settings", role, permissions, flags, options)) {
    const tabs = getVisibleSettingsTabs(
      permissions,
      role === "owner" || (permissions.size === 0 && role === "manager")
    );
    for (const tab of tabs) {
      const href = `/settings?tab=${tab.id}`;
      if (existingHrefs.has(href)) continue;
      if (tab.id === "print") continue;
      pushItem(grouped, "Administration", {
        href,
        label: `إعدادات · ${tab.label}`,
        icon: "Settings",
        keywords: [...tab.searchTerms, tab.label, tab.group, "Settings", "إعدادات", "محرك الطباعة"],
      });
    }
  }

  const order: string[] = navGroups.map((group) => group.label);
  for (const label of grouped.keys()) {
    if (!order.includes(label)) order.push(label);
  }

  return order
    .map((label) => ({
      label,
      items: grouped.get(label) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}
