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
import { Building2, ScrollText, UserPlus } from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { PlatformUsageGlance } from "@/modules/platform/lib/platform-glance";

interface PlatformUsageAnalyticsGlanceProps {
  glance: PlatformUsageGlance;
}

export function PlatformUsageAnalyticsGlance({
  glance,
}: PlatformUsageAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="شركات"
          value={String(glance.total)}
          trend="neutral"
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          label="تجاوزت الحد"
          value={String(glance.over)}
          change="تحتاج ترقية أو تعليق"
          trend={glance.over > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="قرب الحد (≥80%)"
          value={String(glance.near)}
          trend={glance.near > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="معلّقة"
          value={String(glance.suspended)}
          trend="neutral"
        />
      </div>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        {glance.byPlanChart.length > 0 ? (
          <ReportChartSection title="توزيع الباقات (يدوي)" height={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.byPlanChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={32} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}

        {glance.byPressureChart.length > 0 ? (
          <ReportChartSection title="ضغط الحدود" height={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.byPressureChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={32} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        الحدود من الباقة اليدوية للمنصة — مش حالة سداد Stripe.
      </p>

      <ModuleAnalyticsQuickLinks
        title="متابعة السعة"
        description="من مصفوفة الاستهلاك المحمّلة"
        links={[
          {
            href: "/platform",
            label: "الشركات",
            description: "تعليق / تفعيل ومراجعة الصحة",
            icon: Building2,
          },
          {
            href: "/platform/invites",
            label: "الدعوات",
            description: "شركات جديدة",
            icon: UserPlus,
          },
          {
            href: "/platform/audit",
            label: "سجل المنصة",
            description: "تعليق وتغييرات السعة",
            icon: ScrollText,
          },
        ]}
      />
    </div>
  );
}
