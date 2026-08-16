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
import { QrCode, ShoppingBag, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { formatCurrency } from "@/lib/format";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { OnlineOrdersGlance } from "@/modules/online-orders/lib/online-orders-glance";

interface OnlineOrdersAnalyticsGlanceProps {
  glance: OnlineOrdersGlance;
  currency: string;
}

export function OnlineOrdersAnalyticsGlance({
  glance,
  currency,
}: OnlineOrdersAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="نشطة"
          value={String(glance.active)}
          change={`${glance.pending} معلق · ${glance.ready} جاهز`}
          trend="neutral"
          icon={<ShoppingBag className="size-5" />}
        />
        <KpiCard
          label="متوسط الطلب (AOV)"
          value={formatCurrency(glance.aov, currency)}
          change="بدون الملغي"
          trend="neutral"
          icon={<TrendingUp className="size-5" />}
        />
        <KpiCard
          label="إجمالي غير ملغي"
          value={formatCurrency(glance.revenueNonCancelled, currency)}
          change={`${glance.total} طلب محمّل`}
          trend="neutral"
        />
        <KpiCard
          label={`فتحات المنيو (${glance.menuViewsDays}ي)`}
          value={String(glance.menuViewsTotal)}
          change="من إحصاء الرابط/QR"
          trend="neutral"
          icon={<QrCode className="size-5" />}
        />
      </div>

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        {glance.statusChart.length > 0 ? (
          <ReportChartSection title="الطلبات حسب الحالة" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.statusChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}

        {glance.sourceChart.length > 0 ? (
          <ReportChartSection title="مصادر فتح المنيو" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.sourceChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}
      </div>

      <ModuleAnalyticsQuickLinks
        title="تحليل الأونلاين"
        description="من البيانات المحمّلة + إحصاء فتحات المنيو"
        links={[
          {
            href: "/settings?tab=branches",
            label: "إعدادات الفرع / المنيو",
            description: "QR وروابط المشاركة وفتحات المنيو",
            icon: QrCode,
          },
        ]}
      />
    </div>
  );
}
