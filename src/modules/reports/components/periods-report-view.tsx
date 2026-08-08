"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, CalendarRange } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportPeriodsReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  formatPeriodDeltaLabel,
  type PeriodDelta,
} from "@/modules/reports/lib/period-delta";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";

type MetricRow = {
  key: string;
  labelAr: string;
} & PeriodDelta;

interface PeriodsReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  comparison: {
    currentRange: { from: string; to: string };
    previousRange: { from: string; to: string };
    metrics: MetricRow[];
  };
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function isMoneyMetric(key: string) {
  return key === "revenue" || key === "avgTicket" || key === "grossProfit";
}

function trendFromDelta(delta: number): "up" | "down" | "neutral" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

export function PeriodsReportView({
  filters,
  stores,
  currency,
  comparison,
  canExcel,
}: PeriodsReportViewProps) {
  const [pending, startTransition] = useTransition();

  const formatValue = (key: string, value: number) => {
    if (key === "avgMargin") return `${value.toFixed(1)}%`;
    if (key === "orders") return value.toLocaleString("ar-EG");
    if (isMoneyMetric(key)) return formatCurrency(value, currency);
    return String(value);
  };

  const columns: ColumnDef<MetricRow>[] = [
    { header: "المؤشر", accessorKey: "labelAr" },
    {
      id: "current",
      header: "الفترة الحالية",
      cell: ({ row }) => formatValue(row.original.key, row.original.current),
    },
    {
      id: "previous",
      header: "الفترة السابقة",
      cell: ({ row }) => formatValue(row.original.key, row.original.previous),
    },
    {
      id: "delta",
      header: "الفرق",
      cell: ({ row }) => formatValue(row.original.key, row.original.delta),
    },
    {
      id: "deltaPct",
      header: "التغير %",
      cell: ({ row }) => formatPeriodDeltaLabel(row.original),
    },
  ];

  const revenue = comparison.metrics.find((m) => m.key === "revenue");
  const orders = comparison.metrics.find((m) => m.key === "orders");

  return (
    <ReportPage
      title="مقارنة الفترات"
      description="الفترة الحالية مقابل فترة سابقة بنفس الطول — استخدم من/إلى في الفلاتر"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportPeriodsReportExcel(
                  Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [
                      k,
                      v === undefined ? undefined : String(v),
                    ])
                  ) as Record<string, string>
                );
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
        <ReportFiltersBar basePath="/reports/periods" filters={filters} options={{ stores }} />
      }
    >
      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title="الفترة الحالية">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CalendarRange className="size-4" />
            {comparison.currentRange.from} ← {comparison.currentRange.to}
          </p>
        </OperationalCard>
        <OperationalCard title="الفترة السابقة (نفس المدة)">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <ArrowLeftRight className="size-4" />
            {comparison.previousRange.from} ← {comparison.previousRange.to}
          </p>
        </OperationalCard>
      </div>

      <ReportKpiGrid
        columns={2}
        items={[
          {
            label: "الإيراد (حالي)",
            value: formatCurrency(revenue?.current ?? 0, currency),
            change: revenue ? formatPeriodDeltaLabel(revenue) : undefined,
            trend: revenue ? trendFromDelta(revenue.delta) : "neutral",
          },
          {
            label: "الطلبات (حالي)",
            value: String(orders?.current ?? 0),
            change: orders ? formatPeriodDeltaLabel(orders) : undefined,
            trend: orders ? trendFromDelta(orders.delta) : "neutral",
          },
        ]}
      />

      <ReportTable title="مقارنة المؤشرات" columns={columns} data={comparison.metrics} />
    </ReportPage>
  );
}
