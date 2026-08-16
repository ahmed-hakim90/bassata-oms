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
import { MonitorSmartphone, Wifi, WifiOff } from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { DevicesGlance } from "@/modules/devices/lib/devices-glance";

interface DevicesAnalyticsGlanceProps {
  glance: DevicesGlance;
}

export function DevicesAnalyticsGlance({ glance }: DevicesAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="إجمالي الأجهزة"
          value={String(glance.total)}
          icon={<MonitorSmartphone className="size-5" />}
        />
        <KpiCard
          label="نشطة"
          value={String(glance.active)}
          change={`${glance.inactive} متوقفة`}
          trend="neutral"
        />
        <KpiCard
          label="شوفت نشاط (24س)"
          value={String(glance.seenRecently)}
          icon={<Wifi className="size-5" />}
        />
        <KpiCard
          label="بدون نشاط حديث"
          value={String(glance.staleOrNever)}
          change="نشطة ومافيش last_seen خلال يوم — مش سجل أعطال"
          trend={glance.staleOrNever > 0 ? "down" : "neutral"}
          icon={<WifiOff className="size-5" />}
        />
      </div>

      {glance.byStoreChart.length > 0 ? (
        <ReportChartSection title="أجهزة حسب الفرع" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={glance.byStoreChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ModuleAnalyticsQuickLinks
        title="تشغيل الأجهزة"
        description="من بيانات الأجهزة المسجّلة فقط"
        links={[
          {
            href: "/sessions",
            label: "ورديات الكاشير",
            description: "جلسات مفتوحة على الأجهزة",
            icon: MonitorSmartphone,
          },
          {
            href: "/settings?tab=branches",
            label: "إعدادات الفروع",
            description: "ربط الفروع والـ POS",
            icon: Wifi,
          },
        ]}
      />
    </div>
  );
}
