"use client";

import Link from "next/link";
import {
  BarChart3,
  Barcode,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { useTranslation } from "@/lib/i18n/use-translation";

const REPORT_LINKS = [
  {
    href: "/reports/daily-close",
    label: "إقفال اليوم",
    icon: CalendarCheck2,
    description: "نقدية اليوم: المتوقع والفعلي والفرق",
  },
  {
    href: "/reports/sales",
    label: "المبيعات",
    icon: TrendingUp,
    description: "الإيراد والطلبات والاتجاهات",
  },
  {
    href: "/reports/sessions",
    label: "الجلسات",
    icon: Clock,
    description: "تسوية الدرج والفروقات",
  },
  {
    href: "/reports/aging",
    label: "أعمار الذمم",
    icon: Users,
    description: "أرصدة العملاء والموردين حسب العمر",
  },
  {
    href: "/reports/tax",
    label: "الضريبة",
    icon: Percent,
    description: "ضريبة المبيعات وتصدير Excel",
  },
  {
    href: "/reports/profit",
    label: "الأرباح",
    icon: CircleDollarSign,
    description: "الهوامش وتكلفة البضاعة وصافي الربح",
  },
  {
    href: "/reports/inventory",
    label: "المخزون",
    icon: Warehouse,
    description: "التقييم والتشغيلات والانتهاء",
  },
  {
    href: "/reports/replenishment",
    label: "خطة الشراء",
    icon: PackagePlus,
    description: "محتاج تشتري قد إيه حسب مبيعات الشهر",
  },
  {
    href: "/reports/product-card",
    label: "كارت صنف",
    icon: ClipboardList,
    description: "جه وطلع واتساوى والمتاح على أي فترة",
  },
  {
    href: "/reports/expenses",
    label: "المصروفات",
    icon: Wallet,
    description: "مصروفات التشغيل حسب التصنيف",
  },
  {
    href: "/labels",
    label: "ملصقات الباركود",
    icon: Barcode,
    description: "اطبع ملصقات المنتجات",
  },
] as const;

interface ReportsHubProps {
  showProfit: boolean;
  showFinancial: boolean;
  overview?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReportsHub({ showProfit, showFinancial, overview, children }: ReportsHubProps) {
  const { t } = useTranslation();
  const links = REPORT_LINKS.filter((link) => {
    if (link.href === "/reports/profit" && !showProfit) return false;
    if (link.href === "/reports/expenses" && !showFinancial) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        breadcrumb={<span>التقارير</span>}
        title="التقارير"
        description="نظرة تنفيذية، تصدير، وتخطيطات طباعة — للمدير والمالك"
      />
      {overview ?? children}
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <OperationalCard
                title={link.label}
                description={link.description}
                className="transition-shadow hover:shadow-[var(--mds-elevation-2)]"
              >
                <div className="flex items-center gap-[var(--mds-space-3)] text-primary">
                  <Icon className="size-5" />
                  <span className="text-sm font-medium">فتح التقرير</span>
                </div>
              </OperationalCard>
            </Link>
          );
        })}
        <OperationalCard
          title={t("Overview dashboard")}
          description={t("Legacy executive KPI dashboard")}
        >
          <div className="flex items-center gap-[var(--mds-space-3)] text-primary">
            <BarChart3 className="size-5" />
            <span className="text-sm text-muted-foreground">{t("Charts below")}</span>
          </div>
        </OperationalCard>
      </div>
    </div>
  );
}
