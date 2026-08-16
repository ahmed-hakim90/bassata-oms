export type ReportHubLink = {
  href: string;
  label: string;
  icon: string;
  description: string;
  requiresProfit?: boolean;
  requiresFinancial?: boolean;
  requiresCreditSales?: boolean;
};

export type ReportHubGroup = {
  title: string;
  links: ReportHubLink[];
};

/** Single catalog for the reports hub cards and ⌘K search. */
export const REPORT_HUB_GROUPS: ReportHubGroup[] = [
  {
    title: "المبيعات والتشغيل",
    links: [
      {
        href: "/reports/sales",
        label: "تقرير المبيعات",
        icon: "TrendingUp",
        description: "لوحة المبيعات والاتجاهات والتقارير المصغّرة",
      },
      {
        href: "/reports/sales/product",
        label: "مبيعات منتج",
        icon: "Package",
        description: "تقرير مصغّر لصنف واحد: كمية وإيراد",
      },
      {
        href: "/reports/sales/branch",
        label: "ملخص فرع",
        icon: "Building2",
        description: "تقرير مصغّر لفرع: أصناف وموظفين ودفع",
      },
      {
        href: "/reports/sales/cashier",
        label: "ملخص موظف",
        icon: "Users",
        description: "تقرير مصغّر لكاشير: إيراد وجلسات",
      },
      {
        href: "/reports/sessions",
        label: "تقرير الجلسات",
        icon: "Clock",
        description: "تسوية الدرج والفروقات",
      },
      {
        href: "/reports/cashiers",
        label: "أداء الكاشير",
        icon: "Users",
        description: "إيراد وطلبات وفرق الجلسات لكل كاشير",
      },
      {
        href: "/reports/branches",
        label: "مقارنة الفروع",
        icon: "Building2",
        description: "إيراد وربح وهالك حسب الفرع",
      },
      {
        href: "/reports/periods",
        label: "مقارنة الفترات",
        icon: "Calendar",
        description: "الفترة الحالية مقابل السابقة بنفس المدة",
      },
      {
        href: "/reports/heatmap",
        label: "خريطة المبيعات الساعية",
        icon: "Flame",
        description: "كثافة الإيراد حسب الساعة واليوم",
      },
      {
        href: "/reports/daily-close",
        label: "تقرير الإقفال اليومي",
        icon: "CalendarCheck2",
        description: "نقدية اليوم: المتوقع والفعلي والفرق",
      },
    ],
  },
  {
    title: "المالية والربحية",
    links: [
      {
        href: "/reports/aging?side=customers",
        label: "مديونية العملاء",
        icon: "Users",
        description: "أرصدة العملاء المستحقة حسب عمر الدين",
        requiresCreditSales: true,
      },
      {
        href: "/reports/aging?side=suppliers",
        label: "مديونية الموردين",
        icon: "Landmark",
        description: "أرصدة الموردين المستحقة حسب عمر الدين",
      },
      {
        href: "/reports/statement",
        label: "كشف حساب عميل / مورد",
        icon: "BookOpen",
        description: "كشف مفصل بالحركات والرصيد على أي فترة",
      },
      {
        href: "/reports/tax",
        label: "تقرير الضريبة",
        icon: "Percent",
        description: "ضريبة المبيعات وتصدير Excel",
      },
      {
        href: "/reports/profit",
        label: "تقرير الأرباح",
        icon: "CircleDollarSign",
        description: "الهوامش وتكلفة البضاعة وصافي الربح",
        requiresProfit: true,
      },
      {
        href: "/reports/margins",
        label: "ترتيب الهوامش",
        icon: "Percent",
        description: "أصناف وتصنيفات حسب الهامش الإجمالي",
        requiresProfit: true,
      },
      {
        href: "/reports/pnl",
        label: "قائمة الدخل",
        icon: "FileSpreadsheet",
        description: "إيراد وتكلفة ومصروفات وصافي تقديري",
        requiresProfit: true,
      },
      {
        href: "/reports/expenses",
        label: "تقرير المصروفات",
        icon: "Wallet",
        description: "تجميع المصروفات حسب التصنيف والمركز — مش شاشة التسجيل",
        requiresFinancial: true,
      },
    ],
  },
  {
    title: "المخزون",
    links: [
      {
        href: "/reports/inventory",
        label: "تقرير المخزون",
        icon: "Warehouse",
        description: "التقييم والتشغيلات والانتهاء",
      },
      {
        href: "/reports/replenishment",
        label: "تقرير إعادة الطلب",
        icon: "PackagePlus",
        description: "محتاج تشتري قد إيه حسب مبيعات الشهر",
      },
      {
        href: "/reports/product-card",
        label: "كارت صنف",
        icon: "ClipboardList",
        description: "جه وطلع واتساوى والمتاح على أي فترة",
      },
    ],
  },
  {
    title: "أدوات",
    links: [
      {
        href: "/labels",
        label: "ملصقات الباركود",
        icon: "Barcode",
        description: "اطبع ملصقات المنتجات",
      },
    ],
  },
];

export function allReportHubLinks(): ReportHubLink[] {
  return REPORT_HUB_GROUPS.flatMap((group) => group.links);
}

export function filterReportHubGroups(
  showProfit: boolean,
  showFinancial: boolean,
  showCustomerDebt = true
): ReportHubGroup[] {
  return REPORT_HUB_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.requiresProfit && !showProfit) return false;
      if (link.requiresFinancial && !showFinancial) return false;
      if (link.requiresCreditSales && !showCustomerDebt) return false;
      return true;
    }),
  })).filter((group) => group.links.length > 0);
}
