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
  Activity,
  Building2,
  Gauge,
  MonitorSmartphone,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { PlatformOrgGlance } from "@/modules/platform/lib/platform-glance";

interface PlatformOrgAnalyticsGlanceProps {
  glance: PlatformOrgGlance;
}

export function PlatformOrgAnalyticsGlance({
  glance,
}: PlatformOrgAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="شركات نشطة"
          value={String(glance.orgActive)}
          change={`من أصل ${glance.orgTotal}`}
          trend="neutral"
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          label="شركات معلّقة"
          value={String(glance.orgSuspended)}
          change="موقوف تسجيل الدخول"
          trend={glance.orgSuspended > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="دعوات معلّقة"
          value={String(glance.pendingInvites)}
          change="بانتظار القبول"
          trend="neutral"
          icon={<UserPlus className="size-5" />}
        />
        <KpiCard
          label="إجمالي الطلبات"
          value={String(glance.orderTotal)}
          change={`${glance.storeTotal} فرع · ${glance.userTotal} مستخدم · ${glance.deviceTotal} جهاز`}
          trend="neutral"
        />
      </div>

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="هادئة (30 يوم)"
          value={String(glance.quietOrgs)}
          change="نشطة بدون طلب حديث — مش churn مدفوع"
          trend={glance.quietOrgs > 0 ? "down" : "neutral"}
          icon={<Activity className="size-5" />}
        />
      </div>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        {glance.statusChart.length > 0 ? (
          <ReportChartSection title="حالة الشركات" height={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.statusChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={32} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}

        {glance.topOrgsByOrders.some((row) => row.orders > 0) ? (
          <ReportChartSection title="أعلى شركات بالطلبات" height={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={glance.topOrgsByOrders.filter((r) => r.orders > 0)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Bar dataKey="orders" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        نظرة control-plane من ملخص صحة الشركات فقط. مفيش MRR ولا فواتير Stripe —
        الفوترة لسه Planned.
      </p>

      <ModuleAnalyticsQuickLinks
        title="تشغيل المنصة"
        description="أسطح SaaS منفصلة عن لوحة التاجر"
        links={[
          {
            href: "/platform/usage",
            label: "الاستهلاك والحدود",
            description: "باقة يدوية مقابل الاستخدام",
            icon: Gauge,
          },
          {
            href: "/platform/invites",
            label: "الدعوات",
            description: "شركات جديدة بانتظار القبول",
            icon: UserPlus,
          },
          {
            href: "/platform/users",
            label: "المستخدمين",
            description: "أدوار ودخول كحساب",
            icon: Users,
          },
          {
            href: "/platform/devices",
            label: "أجهزة المنصة",
            description: "أجهزة عبر كل الشركات",
            icon: MonitorSmartphone,
          },
          {
            href: "/platform/audit",
            label: "سجل المنصة",
            description: "تعليق، تفعيل، وتغييرات",
            icon: ScrollText,
          },
        ]}
      />
    </div>
  );
}
