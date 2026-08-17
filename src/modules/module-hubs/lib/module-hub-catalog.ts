export type ModuleHubLink = {
  href: string;
  label: string;
  description: string;
  icon: string;
  /** When set, hide unless this feature flag is true (or unset). */
  requiresFlag?:
    | "promotions"
    | "loyalty"
    | "purchases"
    | "purchase_imports"
    | "transfers"
    | "waste"
    | "stock_count"
    | "reports"
    | "general_ledger"
    | "session_expenses"
    | "monthly_closing"
    | "credit_sales";
};

export type ModuleHubDefinition = {
  id: string;
  /** Route path for this hub landing page. */
  href: string;
  title: string;
  description: string;
  breadcrumb: string;
  ctaLabel: string;
  links: ModuleHubLink[];
};

/**
 * Catalog hubs for sidebar groups. Rich boards stay on Inventory `/inventory`
 * and Reports `/reports`; Dashboard stays `/`.
 */
export const MODULE_HUBS = {
  operations: {
    id: "operations",
    href: "/operations",
    title: "التشغيل",
    description: "نقطة البيع والطلبات والورديات — نظرة تشغيل اليوم ثم اختَر الشاشة.",
    breadcrumb: "التشغيل",
    ctaLabel: "فتح",
    links: [
      {
        href: "/pos",
        label: "نقطة البيع",
        description: "بيع سريع من الكاشير",
        icon: "ShoppingCart",
      },
      {
        href: "/kitchen",
        label: "شاشة المطبخ",
        description: "طابور التحضير للمطاعم والكافيهات",
        icon: "ClipboardList",
      },
      {
        href: "/orders",
        label: "الطلبات",
        description: "كل طلبات الفرع وحالتها",
        icon: "Receipt",
      },
      {
        href: "/online-orders",
        label: "طلبات الأونلاين",
        description: "طلبات المنيو والتوصيل",
        icon: "Receipt",
      },
      {
        href: "/sessions",
        label: "ورديات الكاشير",
        description: "فتح وقفل الدرج والتسوية",
        icon: "Clock",
      },
    ],
  },
  "sales-documents": {
    id: "sales-documents",
    href: "/sales-documents",
    title: "مستندات البيع",
    description: "دورة الجملة — مؤشرات المستندات ثم اختَر الشاشة.",
    breadcrumb: "مستندات البيع",
    ctaLabel: "فتح",
    links: [
      {
        href: "/quotations",
        label: "عروض الأسعار",
        description: "عرض سعر للعميل قبل التأكيد",
        icon: "FileSpreadsheet",
      },
      {
        href: "/sales-orders",
        label: "أوامر البيع",
        description: "تأكيد الطلب قبل الفاتورة",
        icon: "ClipboardList",
      },
      {
        href: "/sales-invoices",
        label: "فواتير المبيعات",
        description: "فواتير الجملة والتسليم",
        icon: "Receipt",
      },
      {
        href: "/credit-notes",
        label: "إشعارات دائنة",
        description: "مرتجع أو تسوية على فاتورة",
        icon: "ScrollText",
      },
    ],
  },
  catalog: {
    id: "catalog",
    href: "/catalog",
    title: "المنتجات",
    description: "صحة الأصناف والمخزون — مؤشرات ثم إدارة الكتالوج.",
    breadcrumb: "المنتجات",
    ctaLabel: "فتح",
    links: [
      {
        href: "/products",
        label: "المنتجات",
        description: "أصناف وأسعار ومتغيرات",
        icon: "Package",
      },
      {
        href: "/labels",
        label: "ملصقات الباركود",
        description: "طباعة ملصقات للمنتجات",
        icon: "Barcode",
      },
      {
        href: "/inventory",
        label: "رصيد المخزون",
        description: "شوف المتاح والتنبيهات",
        icon: "Warehouse",
      },
      {
        href: "/reports/product-card",
        label: "كارت صنف",
        description: "حركة صنف على أي فترة",
        icon: "ClipboardList",
        requiresFlag: "reports",
      },
    ],
  },
  purchasing: {
    id: "purchasing",
    href: "/purchasing",
    title: "المشتريات",
    description: "مؤشرات المشتريات وذمم الموردين ثم دورة الشراء.",
    breadcrumb: "المشتريات",
    ctaLabel: "فتح",
    links: [
      {
        href: "/inventory/purchase-requests",
        label: "طلبات الشراء",
        description: "طلب داخلي قبل أمر التوريد",
        icon: "ClipboardList",
        requiresFlag: "purchases",
      },
      {
        href: "/inventory/purchase-orders",
        label: "أوامر التوريد",
        description: "PO للمورد",
        icon: "FileSpreadsheet",
        requiresFlag: "purchases",
      },
      {
        href: "/inventory/purchases",
        label: "فواتير المشتريات",
        description: "استلام وفاتورة مورد",
        icon: "Truck",
        requiresFlag: "purchases",
      },
      {
        href: "/inventory/purchase-returns",
        label: "مرتجعات المشتريات",
        description: "إرجاع لمورد",
        icon: "ScrollText",
        requiresFlag: "purchases",
      },
      {
        href: "/inventory/containers",
        label: "الحاويات",
        description: "شحن واستلام حاويات أمر التوريد",
        icon: "Package",
        requiresFlag: "purchase_imports",
      },
      {
        href: "/inventory/customs-certificates",
        label: "الشهادات الجمركية",
        description: "رقم الجمارك ومصاريف المينا حتى المخزن",
        icon: "FileBadge",
        requiresFlag: "purchase_imports",
      },
      {
        href: "/inventory/suppliers",
        label: "الموردون",
        description: "حسابات ومدفوعات الموردين",
        icon: "Building2",
        requiresFlag: "purchases",
      },
      {
        href: "/inventory/purchases/price-list",
        label: "قائمة أسعار الشراء",
        description: "آخر أسعار التوريد",
        icon: "Tag",
        requiresFlag: "purchases",
      },
    ],
  },
  admin: {
    id: "admin",
    href: "/admin",
    title: "الإدارة",
    description: "صحة الأجهزة والإعدادات — مؤشرات ثم شاشات الإدارة.",
    breadcrumb: "الإدارة",
    ctaLabel: "فتح",
    links: [
      {
        href: "/users",
        label: "المستخدمون",
        description: "صلاحيات وأدوار الفريق",
        icon: "Shield",
      },
      {
        href: "/devices",
        label: "الأجهزة",
        description: "أجهزة الكاشير والربط",
        icon: "MonitorSmartphone",
      },
      {
        href: "/settings",
        label: "الإعدادات",
        description: "فروع وخصائص ونشاط",
        icon: "Settings",
      },
      {
        href: "/audit",
        label: "سجل المراجعة",
        description: "تتبع التغييرات الحساسة",
        icon: "ScrollText",
      },
      {
        href: "/guide",
        label: "دليل الاستخدام",
        description: "شرح سريع للتشغيل",
        icon: "BookOpen",
      },
      {
        href: "/account",
        label: "حسابي",
        description: "الملف وكلمة المرور",
        icon: "Users",
      },
    ],
  },
  customers: {
    id: "customers",
    href: "/customers",
    title: "العملاء",
    description: "مديونية وتحصيل العملاء — مؤشرات ثم الدليل والولاء.",
    breadcrumb: "العملاء",
    ctaLabel: "فتح",
    links: [
      {
        href: "/customers/directory",
        label: "دليل العملاء",
        description: "بحث وإنشاء ومتابعة الأرصدة",
        icon: "Users",
      },
      {
        href: "/customers/loyalty",
        label: "الولاء",
        description: "نقاط صادرة ومستخدمة",
        icon: "Heart",
        requiresFlag: "loyalty",
      },
      {
        href: "/promotions",
        label: "العروض",
        description: "خصومات وعروض تشغيل",
        icon: "Tag",
        requiresFlag: "promotions",
      },
      {
        href: "/reports/aging?side=customers",
        label: "مديونية العملاء",
        description: "أعمار الذمم والتحصيل",
        icon: "Calendar",
        requiresFlag: "credit_sales",
      },
      {
        href: "/reports/statement?party=customer",
        label: "كشف حساب عميل",
        description: "حركات مفصّلة على فترة",
        icon: "BookOpen",
        requiresFlag: "reports",
      },
    ],
  },
  accounting: {
    id: "accounting",
    href: "/accounting",
    title: "الحسابات",
    description: "مؤشرات الدفاتر والقيود ثم التقارير المالية.",
    breadcrumb: "الحسابات",
    ctaLabel: "فتح",
    links: [
      {
        href: "/accounting/accounts",
        label: "دليل الحسابات",
        description: "شجرة الحسابات والأرصدة",
        icon: "Landmark",
        requiresFlag: "general_ledger",
      },
      {
        href: "/accounting/journals",
        label: "القيود اليومية",
        description: "قيود يدوية وآلية",
        icon: "ScrollText",
        requiresFlag: "general_ledger",
      },
      {
        href: "/accounting/trial-balance",
        label: "ميزان المراجعة",
        description: "أرصدة الفترة",
        icon: "BarChart3",
        requiresFlag: "general_ledger",
      },
      {
        href: "/accounting/ledger",
        label: "دفتر الأستاذ",
        description: "حركة حساب واحد",
        icon: "BookOpen",
        requiresFlag: "general_ledger",
      },
      {
        href: "/accounting/income-statement",
        label: "قائمة الدخل",
        description: "إيراد ومصروف وصافي",
        icon: "FileSpreadsheet",
        requiresFlag: "general_ledger",
      },
      {
        href: "/accounting/balance-sheet",
        label: "الميزانية",
        description: "المركز المالي",
        icon: "CircleDollarSign",
        requiresFlag: "general_ledger",
      },
      {
        href: "/treasury",
        label: "الخزائن",
        description: "رئيسية وفروع وسجل حركات النقد",
        icon: "Landmark",
      },
      {
        href: "/expenses",
        label: "المصروفات",
        description: "تسجيل ومراجعة المصروف",
        icon: "Wallet",
        requiresFlag: "session_expenses",
      },
      {
        href: "/monthly-closing",
        label: "الإقفال الشهري",
        description: "قفل الفترة المحاسبية",
        icon: "CalendarCheck",
        requiresFlag: "monthly_closing",
      },
    ],
  },
} as const satisfies Record<string, ModuleHubDefinition>;

export type ModuleHubId = keyof typeof MODULE_HUBS;
