"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportHeatmapReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { HeatmapCell } from "@/modules/reports/services/executive-analytics.service";

interface HeatmapReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  heatmap: {
    mode: "weekday" | "day";
    cells: HeatmapCell[];
    maxRevenue: number;
    axisKeys: { key: string; label: string }[];
  };
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function cellIntensity(revenue: number, max: number): number {
  if (max <= 0 || revenue <= 0) return 0;
  return Math.min(1, revenue / max);
}

export function HeatmapReportView({
  filters,
  stores,
  currency,
  heatmap,
  canExcel,
}: HeatmapReportViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const lookup = new Map(
    heatmap.cells.map((c) => [`${c.axisKey}|${c.hour}`, c] as const)
  );
  const peak = heatmap.cells.reduce(
    (best, c) => (c.revenue > (best?.revenue ?? 0) ? c : best),
    null as HeatmapCell | null
  );

  const setMode = (mode: "weekday" | "day") => {
    const qs = reportFiltersToSearchParams(filters);
    const params = new URLSearchParams(qs);
    params.set("heatmapMode", mode);
    router.push(`/reports/heatmap?${params.toString()}`);
  };

  return (
    <ReportPage
      title="خريطة المبيعات الساعية"
      description="كثافة الإيراد حسب الساعة × يوم الأسبوع أو التاريخ"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportHeatmapReportExcel({
                  ...(Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [
                      k,
                      v === undefined ? undefined : String(v),
                    ])
                  ) as Record<string, string>),
                  heatmapMode: heatmap.mode,
                });
                downloadBase64Excel(result.base64, result.filename);
                toast.success("تم تصدير Excel");
              } catch {
                toast.error("فشل التصدير");
              }
            });
          }}
        />
      }
      filters={
        <div className="flex flex-col gap-[var(--mds-space-3)]">
          <ReportFiltersBar
            basePath="/reports/heatmap"
            filters={filters}
            options={{ stores }}
          />
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              size="sm"
              variant={heatmap.mode === "weekday" ? "default" : "outline"}
              onClick={() => setMode("weekday")}
            >
              حسب يوم الأسبوع
            </Button>
            <Button
              type="button"
              size="sm"
              variant={heatmap.mode === "day" ? "default" : "outline"}
              onClick={() => setMode("day")}
            >
              حسب التاريخ
            </Button>
          </div>
        </div>
      }
    >
      <ReportKpiGrid
        columns={2}
        items={[
          {
            label: "أعلى خلية",
            value: peak
              ? `${peak.axisLabel} · ${String(peak.hour).padStart(2, "0")}:00`
              : "—",
            icon: <Flame className="size-5" />,
          },
          {
            label: "إيراد الذروة",
            value: formatCurrency(peak?.revenue ?? 0, currency),
          },
        ]}
      />

      <OperationalCard title="الخريطة الحرارية">
        {heatmap.axisKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مبيعات في الفترة المحددة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky start-0 bg-background p-1 text-start font-medium">
                    {heatmap.mode === "weekday" ? "اليوم" : "التاريخ"}
                  </th>
                  {hours.map((h) => (
                    <th key={h} className="p-1 font-normal text-muted-foreground tabular-nums">
                      {String(h).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.axisKeys.map((axis) => (
                  <tr key={axis.key}>
                    <td className="sticky start-0 bg-background p-1 whitespace-nowrap font-medium">
                      {axis.label}
                    </td>
                    {hours.map((h) => {
                      const cell = lookup.get(`${axis.key}|${h}`);
                      const intensity = cellIntensity(
                        cell?.revenue ?? 0,
                        heatmap.maxRevenue
                      );
                      const title = cell
                        ? `${formatCurrency(cell.revenue, currency)} · ${cell.orderCount} طلب`
                        : "—";
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            title={title}
                            className="size-7 rounded-sm border border-border/40"
                            style={{
                              backgroundColor:
                                intensity === 0
                                  ? "transparent"
                                  : `color-mix(in oklab, var(--primary) ${Math.round(intensity * 100)}%, transparent)`,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCard>
    </ReportPage>
  );
}
