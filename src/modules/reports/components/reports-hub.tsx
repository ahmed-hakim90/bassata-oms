"use client";

import Link from "next/link";
import {
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Flame,
  Landmark,
  Mail,
  Package,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { filterReportHubGroups } from "@/modules/reports/lib/report-hub-links";

const REPORT_HUB_ICONS: Record<string, LucideIcon> = {
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Flame,
  Landmark,
  Package,
  PackagePlus,
  Percent,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
};

interface ReportsHubProps {
  showProfit: boolean;
  showFinancial: boolean;
  showCustomerDebt?: boolean;
  canManageSchedule?: boolean;
}

export function ReportsHub({
  showProfit,
  showFinancial,
  showCustomerDebt = true,
  canManageSchedule = false,
}: ReportsHubProps) {
  const groups = filterReportHubGroups(showProfit, showFinancial, showCustomerDebt);

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <PageHeader
        breadcrumb={<span>التقارير</span>}
        title="التقارير"
        description="اختَر التقرير من الكارت — يفتح مباشرة"
        action={
          canManageSchedule ? (
            <CompactActions>
              <CompactAction
                label="جدولة إيميل التقارير"
                icon={Mail}
                href="/settings?tab=features#report-schedule"
              />
            </CompactActions>
          ) : null
        }
      />

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
          <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((link) => {
              const Icon = REPORT_HUB_ICONS[link.icon] ?? ClipboardList;
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
