"use client";

import Link from "next/link";
import {
  Barcode,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Flame,
  Mail,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReportLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  requiresProfit?: boolean;
  requiresFinancial?: boolean;
};

const REPORT_GROUPS: { title: string; links: ReportLink[] }[] = [
  {
    title: "المبيعات والتشغيل",
    links: [
      {
        href: "/reports/sales",
        label: "تقرير المبيعات",
        icon: TrendingUp,
        description: "الإيراد والطلبات والاتجاهات",
      },
      {
        href: "/reports/sessions",
        label: "تقرير الجلسات",
        icon: Clock,
        description: "تسوية الدرج والفروقات",
      },
      {
        href: "/reports/cashiers",
        label: "أداء الكاشير",
        icon: Users,
        description: "إيراد وطلبات وفرق الجلسات لكل كاشير",
      },
      {
        href: "/reports/branches",
        label: "مقارنة الفروع",
        icon: Building2,
        description: "إيراد وربح وهالك حسب الفرع",
      },
      {
        href: "/reports/periods",
        label: "مقارنة الفترات",
        icon: Calendar,
        description: "الفترة الحالية مقابل السابقة بنفس المدة",
      },
      {
        href: "/reports/heatmap",
        label: "خريطة المبيعات الساعية",
        icon: Flame,
        description: "كثافة الإيراد حسب الساعة واليوم",
      },
      {
        href: "/reports/daily-close",
        label: "تقرير الإقفال اليومي",
        icon: CalendarCheck2,
        description: "نقدية اليوم: المتوقع والفعلي والفرق",
      },
    ],
  },
  {
    title: "المالية والربحية",
    links: [
      {
        href: "/reports/aging",
        label: "تقرير أعمار الذمم",
        icon: Users,
        description: "أرصدة العملاء والموردين حسب العمر",
      },
      {
        href: "/reports/tax",
        label: "تقرير الضريبة",
        icon: Percent,
        description: "ضريبة المبيعات وتصدير Excel",
      },
      {
        href: "/reports/profit",
        label: "تقرير الأرباح",
        icon: CircleDollarSign,
        description: "الهوامش وتكلفة البضاعة وصافي الربح",
        requiresProfit: true,
      },
      {
        href: "/reports/margins",
        label: "ترتيب الهوامش",
        icon: Percent,
        description: "أصناف وتصنيفات حسب الهامش الإجمالي",
        requiresProfit: true,
      },
      {
        href: "/reports/pnl",
        label: "قائمة الدخل",
        icon: FileSpreadsheet,
        description: "إيراد وتكلفة ومصروفات وصافي تقديري",
        requiresProfit: true,
      },
      {
        href: "/reports/expenses",
        label: "تقرير المصروفات",
        icon: Wallet,
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
        icon: Warehouse,
        description: "التقييم والتشغيلات والانتهاء",
      },
      {
        href: "/reports/replenishment",
        label: "تقرير إعادة الطلب",
        icon: PackagePlus,
        description: "محتاج تشتري قد إيه حسب مبيعات الشهر",
      },
      {
        href: "/reports/product-card",
        label: "كارت صنف",
        icon: ClipboardList,
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
        icon: Barcode,
        description: "اطبع ملصقات المنتجات",
      },
    ],
  },
];

interface ReportsHubProps {
  showProfit: boolean;
  showFinancial: boolean;
  canManageSchedule?: boolean;
}

export function ReportsHub({
  showProfit,
  showFinancial,
  canManageSchedule = false,
}: ReportsHubProps) {
  const groups = REPORT_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => {
      if (link.requiresProfit && !showProfit) return false;
      if (link.requiresFinancial && !showFinancial) return false;
      return true;
    }),
  })).filter((group) => group.links.length > 0);

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        breadcrumb={<span>التقارير</span>}
        title="التقارير"
        description="اختَر التقرير من الكارت — يفتح مباشرة"
        action={
          canManageSchedule ? (
            <Link
              href="/settings?tab=features#report-schedule"
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
            >
              <Mail className="size-4" />
              جدولة إيميل التقارير
            </Link>
          ) : null
        }
      />

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
          <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group block h-full rounded-[var(--mds-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <OperationalCard
                    title={link.label}
                    description={link.description}
                    className="h-full cursor-pointer transition-shadow group-hover:shadow-[var(--mds-elevation-2)] group-focus-visible:shadow-[var(--mds-elevation-2)]"
                  >
                    <div className="flex items-center gap-[var(--mds-space-3)] text-primary">
                      <Icon className="size-5 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">فتح التقرير</span>
                    </div>
                  </OperationalCard>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
