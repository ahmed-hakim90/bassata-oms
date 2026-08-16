"use client";

import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatCurrency } from "@/lib/format";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { AgingBucketsChart } from "@/modules/reports/components/aging-buckets-chart";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { HubAnalyticsPayload } from "@/modules/module-hubs/lib/hub-analytics-types";

const ANALYSIS_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
};

interface HubAnalyticsSectionProps {
  analytics: HubAnalyticsPayload;
}

export function HubAnalyticsSection({ analytics }: HubAnalyticsSectionProps) {
  const currency = analytics.currency ?? "EGP";
  const chartRows = analytics.chart?.rows.filter((row) => row.value !== 0) ?? [];
  const analysisLinks = (analytics.analysisLinks ?? []).map((link) => ({
    href: link.href,
    label: link.label,
    description: link.description,
    icon: ANALYSIS_ICONS[link.icon] ?? ClipboardList,
  }));

  return (
    <div className="flex flex-col gap-3">
      {analytics.kpis.length > 0 ? (
        <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
          {analytics.kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              change={kpi.change}
              trend={kpi.trend}
            />
          ))}
        </div>
      ) : null}

      {analytics.agingBuckets && analytics.agingTitle ? (
        <AgingBucketsChart
          title={analytics.agingTitle}
          buckets={analytics.agingBuckets}
          currency={currency}
        />
      ) : null}

      {analytics.chart && chartRows.length > 0 ? (
        <ReportChartSection title={analytics.chart.title} height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis width={48} />
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return analytics.chart?.format === "currency"
                    ? formatCurrency(n, currency)
                    : String(n);
                }}
              />
              <Bar dataKey="value" fill="#0F766E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="تحليل سريع"
        description="انتقل للتقرير أو الشاشة التفصيلية"
        links={analysisLinks}
      />
    </div>
  );
}
