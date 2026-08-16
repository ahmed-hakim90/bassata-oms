"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarCheck,
  ClipboardList,
  Users,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatCurrency } from "@/lib/format";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";

export interface SessionsGlanceChartRow {
  label: string;
  variance: number;
}

interface SessionsAnalyticsGlanceProps {
  openCount: number;
  openSalesTotal: number;
  closed30dCount: number;
  variance30d: number;
  currency: string;
  varianceChart: SessionsGlanceChartRow[];
  scopeLabel: string;
}

export function SessionsAnalyticsGlance({
  openCount,
  openSalesTotal,
  closed30dCount,
  variance30d,
  currency,
  varianceChart,
  scopeLabel,
}: SessionsAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="مفتوحة الآن"
          value={String(openCount)}
          change={scopeLabel}
          trend="neutral"
          icon={<Wallet className="size-5" />}
        />
        <KpiCard
          label="مبيعات الجلسات المفتوحة"
          value={formatCurrency(openSalesTotal, currency)}
          change="من الجلسات النشطة فقط"
          trend="neutral"
        />
        <KpiCard
          label="مقفولة (30 يوم)"
          value={String(closed30dCount)}
          icon={<CalendarCheck className="size-5" />}
        />
        <KpiCard
          label="فرق الدرج (30 يوم)"
          value={formatCurrency(variance30d, currency)}
          change={variance30d === 0 ? "متوازن" : variance30d > 0 ? "زيادة" : "نقص"}
          trend={variance30d === 0 ? "neutral" : variance30d > 0 ? "up" : "down"}
        />
      </div>

      {varianceChart.length > 0 ? (
        <ReportChartSection title="فرق الدرج حسب الكاشير (30 يوم)" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={varianceChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis width={48} />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(
                    typeof value === "number" ? value : Number(value),
                    currency
                  )
                }
              />
              <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                {varianceChart.map((row) => (
                  <Cell
                    key={row.label}
                    fill={row.variance >= 0 ? "#0F766E" : "#DC2626"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="تحليل الكاش والجلسات"
        description="تقارير بدون تحميل إضافي على هذه الصفحة"
        links={[
          {
            href: "/reports/sessions",
            label: "تقرير الجلسات",
            description: "فروقات وإقفال بالتفصيل",
            icon: ClipboardList,
          },
          {
            href: "/reports/cashiers",
            label: "أداء الكاشير",
            description: "مقارنة الموظفين",
            icon: Users,
          },
          {
            href: "/reports/daily-close",
            label: "الإقفال اليومي",
            description: "ملخص يوم العمل",
            icon: CalendarCheck,
          },
        ]}
      />
    </div>
  );
}
