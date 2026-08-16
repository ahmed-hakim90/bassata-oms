import { formatCurrency } from "@/lib/format";
import type { AgingBuckets } from "@/modules/reports/lib/aging-buckets";
import type {
  HubAnalysisLink,
  HubAnalyticsPayload,
  HubKpi,
} from "@/modules/module-hubs/lib/hub-analytics-types";

const OPERATIONS_LINKS: HubAnalysisLink[] = [
  {
    href: "/reports/sales",
    label: "تقرير المبيعات",
    description: "اتجاهات وتفاصيل اليوم والفترة",
    icon: "TrendingUp",
  },
  {
    href: "/reports/sessions",
    label: "تقرير الجلسات",
    description: "فروقات الدرج والإقفال",
    icon: "Clock",
  },
  {
    href: "/reports/daily-close",
    label: "الإقفال اليومي",
    description: "نقدية اليوم المتوقع والفعلي",
    icon: "CalendarCheck",
  },
];

const SALES_DOCS_LINKS: HubAnalysisLink[] = [
  {
    href: "/sales-invoices",
    label: "فواتير المبيعات",
    description: "المستندات المفتوحة والتسليم",
    icon: "Receipt",
  },
  {
    href: "/reports/sales",
    label: "تقرير المبيعات",
    description: "إيراد حسب الفترة",
    icon: "TrendingUp",
  },
  {
    href: "/customers/directory",
    label: "دليل العملاء",
    description: "أرصدة العملاء المرتبطين",
    icon: "Users",
  },
];

const CATALOG_LINKS: HubAnalysisLink[] = [
  {
    href: "/inventory",
    label: "لوحة المخزون",
    description: "صحة الرصيد والتنبيهات",
    icon: "Warehouse",
  },
  {
    href: "/reports/product-card",
    label: "كارت صنف",
    description: "حركة صنف على أي فترة",
    icon: "ClipboardList",
  },
  {
    href: "/reports/replenishment",
    label: "إعادة الطلب",
    description: "اقتراح كميات الشراء",
    icon: "Package",
  },
];

const PURCHASING_LINKS: HubAnalysisLink[] = [
  {
    href: "/inventory/purchases",
    label: "فواتير الشراء",
    description: "استلام ومراجعة",
    icon: "Truck",
  },
  {
    href: "/reports/aging?side=suppliers",
    label: "مديونية الموردين",
    description: "أعمار الذمم بالتفصيل",
    icon: "Calendar",
  },
  {
    href: "/inventory/suppliers",
    label: "الموردون",
    description: "حسابات ومدفوعات",
    icon: "Building2",
  },
];

const CUSTOMERS_LINKS: HubAnalysisLink[] = [
  {
    href: "/reports/aging?side=customers",
    label: "مديونية العملاء",
    description: "أعمار الذمم بالتفصيل",
    icon: "Calendar",
  },
  {
    href: "/reports/statement?party=customer",
    label: "كشف حساب",
    description: "حركة عميل على فترة",
    icon: "BookOpen",
  },
  {
    href: "/customers/loyalty",
    label: "الولاء",
    description: "نقاط صادرة ومستخدمة",
    icon: "Heart",
  },
];

const ACCOUNTING_LINKS: HubAnalysisLink[] = [
  {
    href: "/accounting/income-statement",
    label: "قائمة الدخل",
    description: "من دفتر الأستاذ",
    icon: "FileSpreadsheet",
  },
  {
    href: "/accounting/trial-balance",
    label: "ميزان المراجعة",
    description: "أرصدة الحسابات",
    icon: "BarChart3",
  },
  {
    href: "/expenses",
    label: "المصروفات",
    description: "تسجيل ومراجعة",
    icon: "Wallet",
  },
];

const ADMIN_LINKS: HubAnalysisLink[] = [
  {
    href: "/devices",
    label: "الأجهزة",
    description: "ربط وحالة الكاشير",
    icon: "MonitorSmartphone",
  },
  {
    href: "/settings",
    label: "الإعدادات",
    description: "فروع وخصائص",
    icon: "Settings",
  },
  {
    href: "/audit",
    label: "سجل المراجعة",
    description: "تتبع التغييرات",
    icon: "ScrollText",
  },
];

export function buildOperationsHubAnalytics(input: {
  currency: string;
  todaySales: number;
  todayOrders: number;
  avgTicket: number;
  openSessions: number;
  onlineActive: number;
  salesSparkline: { hour: string; total: number }[];
}): HubAnalyticsPayload {
  return {
    currency: input.currency,
    kpis: [
      {
        label: "مبيعات اليوم",
        value: formatCurrency(input.todaySales, input.currency),
        change: "طلبات مكتملة اليوم",
        trend: "neutral",
      },
      {
        label: "طلبات اليوم",
        value: String(input.todayOrders),
      },
      {
        label: "متوسط التذكرة",
        value: formatCurrency(input.avgTicket, input.currency),
      },
      {
        label: "جلسات مفتوحة",
        value: String(input.openSessions),
        change:
          input.onlineActive > 0
            ? `${input.onlineActive} طلب أونلاين نشط`
            : "تشغيل الفرع",
        trend: "neutral",
      },
    ],
    chart: {
      title: "مبيعات الساعة (اليوم)",
      format: "currency",
      rows: input.salesSparkline.map((row) => ({
        label: row.hour,
        value: row.total,
      })),
    },
    analysisLinks: OPERATIONS_LINKS,
  };
}

export function buildSalesDocumentsHubAnalytics(input: {
  currency: string;
  byKind: { label: string; count: number }[];
  openTotal: number;
  draftCount: number;
  issuedCount: number;
}): HubAnalyticsPayload {
  const kpis: HubKpi[] = [
    {
      label: "مسودات",
      value: String(input.draftCount),
    },
    {
      label: "صادرة / مؤكدة",
      value: String(input.issuedCount),
    },
    {
      label: "قيمة مفتوحة",
      value: formatCurrency(input.openTotal, input.currency),
      change: "غير مسلّمة بالكامل",
      trend: "neutral",
    },
    {
      label: "أنواع المستندات",
      value: String(input.byKind.reduce((sum, row) => sum + row.count, 0)),
      change: "في الفرع الحالي",
    },
  ];
  return {
    currency: input.currency,
    kpis,
    chart: {
      title: "المستندات حسب النوع",
      format: "number",
      rows: input.byKind.map((row) => ({ label: row.label, value: row.count })),
    },
    analysisLinks: SALES_DOCS_LINKS,
  };
}

export function buildCatalogHubAnalytics(input: {
  currency: string;
  totalSkus: number;
  lowStock: number;
  nearExpiry: number;
  sellValue: number;
}): HubAnalyticsPayload {
  return {
    currency: input.currency,
    kpis: [
      { label: "أصناف متتبعة", value: String(input.totalSkus) },
      {
        label: "تحت حد الطلب",
        value: String(input.lowStock),
        trend: input.lowStock > 0 ? "down" : "neutral",
        change: input.lowStock > 0 ? "يحتاج مراجعة" : "مستقر",
      },
      {
        label: "قرب انتهاء",
        value: String(input.nearExpiry),
        trend: input.nearExpiry > 0 ? "down" : "neutral",
      },
      {
        label: "قيمة البيع التقديرية",
        value: formatCurrency(input.sellValue, input.currency),
        change: "رصيد × سعر البيع",
      },
    ],
    chart: {
      title: "صحة الكتالوج",
      format: "number",
      rows: [
        { label: "أصناف", value: input.totalSkus },
        { label: "منخفض", value: input.lowStock },
        { label: "صلاحية", value: input.nearExpiry },
      ],
    },
    analysisLinks: CATALOG_LINKS,
  };
}

export function buildPurchasingHubAnalytics(input: {
  currency: string;
  draftCount: number;
  receivedCount: number;
  supplierDue: number;
  paid30d: number;
  agingBuckets?: AgingBuckets | null;
}): HubAnalyticsPayload {
  const hasAging =
    input.agingBuckets != null &&
    Object.values(input.agingBuckets).some((v) => v > 0);

  return {
    currency: input.currency,
    kpis: [
      { label: "مسودات شراء", value: String(input.draftCount) },
      { label: "مستلمة", value: String(input.receivedCount) },
      {
        label: "مستحق للموردين",
        value: formatCurrency(input.supplierDue, input.currency),
        trend: input.supplierDue > 0 ? "down" : "neutral",
      },
      {
        label: "مدفوع (30 يوم)",
        value: formatCurrency(input.paid30d, input.currency),
      },
    ],
    agingBuckets: hasAging ? input.agingBuckets ?? undefined : undefined,
    agingTitle: hasAging ? "أعمار ذمم الموردين" : undefined,
    chart: {
      title: "فواتير الشراء",
      format: "number",
      rows: [
        { label: "مسودة", value: input.draftCount },
        { label: "مستلمة", value: input.receivedCount },
      ],
    },
    analysisLinks: PURCHASING_LINKS,
  };
}

export function buildCustomersHubAnalytics(input: {
  currency: string;
  customerCount: number;
  outstanding: number;
  collected30d: number;
  partiesWithBalance: number;
  agingBuckets?: AgingBuckets | null;
}): HubAnalyticsPayload {
  const hasAging =
    input.agingBuckets != null &&
    Object.values(input.agingBuckets).some((v) => v > 0);

  return {
    currency: input.currency,
    kpis: [
      { label: "عملاء", value: String(input.customerCount) },
      {
        label: "مديونية",
        value: formatCurrency(input.outstanding, input.currency),
        trend: input.outstanding > 0 ? "down" : "neutral",
      },
      {
        label: "تحصيل (30 يوم)",
        value: formatCurrency(input.collected30d, input.currency),
        trend: "up",
      },
      {
        label: "أرصدة مفتوحة",
        value: String(input.partiesWithBalance),
      },
    ],
    agingBuckets: hasAging ? input.agingBuckets ?? undefined : undefined,
    agingTitle: hasAging ? "أعمار ذمم العملاء" : undefined,
    chart: hasAging
      ? undefined
      : {
          title: "ملخص العملاء",
          format: "number",
          rows: [
            { label: "عملاء", value: input.customerCount },
            { label: "أرصدة", value: input.partiesWithBalance },
          ],
        },
    analysisLinks: CUSTOMERS_LINKS,
  };
}

export function buildAccountingHubAnalytics(input: {
  accountCount: number;
  postableCount: number;
  postedCount: number;
  draftCount: number;
  voidCount: number;
  autoPostedCount: number;
}): HubAnalyticsPayload {
  return {
    kpis: [
      { label: "حسابات نشطة", value: String(input.accountCount) },
      { label: "قابلة للترحيل", value: String(input.postableCount) },
      { label: "قيود مرحّلة", value: String(input.postedCount), change: "من آخر 200" },
      {
        label: "مسودات قيود",
        value: String(input.draftCount),
        trend: input.draftCount > 0 ? "down" : "neutral",
      },
    ],
    chart: {
      title: "حالة القيود (عينة حديثة)",
      format: "number",
      rows: [
        { label: "مرحّل", value: input.postedCount },
        { label: "أوتو", value: input.autoPostedCount },
        { label: "مسودة", value: input.draftCount },
        { label: "ملغي", value: input.voidCount },
      ],
    },
    analysisLinks: ACCOUNTING_LINKS,
  };
}

export function buildAdminHubAnalytics(input: {
  totalDevices: number;
  activeDevices: number;
  seenRecently: number;
  staleOrNever: number;
  byStoreChart: { label: string; count: number }[];
}): HubAnalyticsPayload {
  return {
    kpis: [
      { label: "أجهزة", value: String(input.totalDevices) },
      { label: "نشطة", value: String(input.activeDevices) },
      {
        label: "شوهدت (24س)",
        value: String(input.seenRecently),
        change: "last_seen حديث",
      },
      {
        label: "ساكنة / بلا ظهور",
        value: String(input.staleOrNever),
        trend: input.staleOrNever > 0 ? "down" : "neutral",
      },
    ],
    chart: {
      title: "الأجهزة حسب الفرع",
      format: "number",
      rows: input.byStoreChart.map((row) => ({
        label: row.label,
        value: row.count,
      })),
    },
    analysisLinks: ADMIN_LINKS,
  };
}
