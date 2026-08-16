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
import { Clock, CookingPot } from "lucide-react";
import { KpiCard } from "@/components/Velora/kpi-card";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import type { KitchenGlance } from "@/modules/kitchen/lib/kitchen-glance";

interface KitchenAnalyticsGlanceProps {
  glance: KitchenGlance;
}

export function KitchenAnalyticsGlance({ glance }: KitchenAnalyticsGlanceProps) {
  return (
    <div className="flex flex-col gap-[var(--mds-space-4)]">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="الطابور الحالي"
          value={String(glance.backlog)}
          change={`${glance.queued} انتظار · ${glance.preparing} تحضير · ${glance.ready} جاهز`}
          trend="neutral"
          icon={<CookingPot className="size-5" />}
        />
        <KpiCard label="بالانتظار" value={String(glance.queued)} />
        <KpiCard label="قيد التحضير" value={String(glance.preparing)} />
        <KpiCard
          label="أقدم طلب في الطابور"
          value={
            glance.oldestWaitMinutes == null
              ? "—"
              : glance.oldestWaitMinutes < 60
                ? `${glance.oldestWaitMinutes} د`
                : `${Math.floor(glance.oldestWaitMinutes / 60)}س ${glance.oldestWaitMinutes % 60}د`
          }
          change="من وقت إنشاء الأوردر — مش زمن تحضير مقاس"
          trend="neutral"
          icon={<Clock className="size-5" />}
        />
      </div>

      {glance.statusChart.length > 0 ? (
        <ReportChartSection title="توزيع الطابور" height={180}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={glance.statusChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <p className="text-xs text-muted-foreground">
        مفيش أحداث زمن تحضير (KDS timing) في النظام حاليًا — لما تتسجل انتقالات الحالة
        بوقت، نقدر نضيف متوسط التحضير وذروة الساعات بدون تخمين.
      </p>
    </div>
  );
}
