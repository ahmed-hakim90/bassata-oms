"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Landmark,
  Scale,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatCurrency } from "@/lib/format";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { ExpensesGlance } from "@/modules/expenses/lib/expenses-glance";

interface ExpensesAnalyticsGlanceProps {
  glance: ExpensesGlance;
  currency: string;
}

export function ExpensesAnalyticsGlance({
  glance,
  currency,
}: ExpensesAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="معتمد (الفلتر الحالي)"
          value={formatCurrency(glance.approvedAmount, currency)}
          change={`${glance.approvedCount} مصروف`}
          trend="neutral"
          icon={<Wallet className="size-5" />}
        />
        <KpiCard
          label="قيد الاعتماد"
          value={String(glance.pendingCount)}
          change={
            glance.pendingCount > 0 ? "يحتاج مراجعة" : "مفيش معلّق"
          }
          trend={glance.pendingCount > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="عدد في القائمة"
          value={String(glance.rowCount)}
        />
        <KpiCard
          label="إجمالي القائمة"
          value={formatCurrency(glance.totalAmount, currency)}
          change="كل الحالات في الفلتر"
          trend="neutral"
        />
      </div>

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        {glance.categoryChart.length > 0 ? (
          <ReportChartSection title="المعتمد حسب التصنيف" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.categoryChart}>
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
                <Bar dataKey="amount" fill="#B45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}

        {glance.monthlyChart.length > 0 ? (
          <ReportChartSection title="المعتمد شهريًا" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.monthlyChart}>
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
                <Bar dataKey="amount" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}
      </div>

      <ModuleAnalyticsQuickLinks
        title="تحليل مالي"
        description="التقارير والدفاتر — الدفاتر مصدر الحقيقة"
        links={[
          {
            href: "/reports/expenses",
            label: "تقرير المصروفات",
            description: "تجميع مراكز وتصنفيات + Excel",
            icon: FileSpreadsheet,
          },
          {
            href: "/reports/pnl",
            label: "الأرباح والخسائر",
            description: "تقدير تشغيلي سريع",
            icon: BarChart3,
          },
          {
            href: "/accounting/income-statement",
            label: "قائمة الدخل",
            description: "من دفتر الأستاذ",
            icon: BookOpen,
          },
          {
            href: "/accounting/trial-balance",
            label: "ميزان المراجعة",
            description: "أرصدة الفترة",
            icon: Scale,
          },
          {
            href: "/accounting",
            label: "دليل الحسابات",
            description: "قيود وترحيل",
            icon: Landmark,
          },
        ]}
      />
    </div>
  );
}
