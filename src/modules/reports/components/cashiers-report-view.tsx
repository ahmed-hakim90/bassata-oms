"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Receipt, TrendingUp, Users, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportCashiersReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { CashierPerformanceRow } from "@/modules/reports/services/executive-analytics.service";

interface CashiersReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  rows: CashierPerformanceRow[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function CashiersReportView({
  filters,
  stores,
  currency,
  rows,
  canExcel,
}: CashiersReportViewProps) {
  const [pending, startTransition] = useTransition();

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const totalVariance = rows.reduce((s, r) => s + r.totalVariance, 0);

  const columns: ColumnDef<CashierPerformanceRow>[] = [
    { header: "الكاشير", accessorKey: "cashierName" },
    { header: "الطلبات", accessorKey: "orderCount" },
    {
      id: "revenue",
      header: "الإيراد",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "avgTicket",
      header: "متوسط الطلب",
      cell: ({ row }) => formatCurrency(row.original.avgTicket, currency),
    },
    { header: "الجلسات", accessorKey: "sessionCount" },
    { header: "مغلقة", accessorKey: "closedSessionCount" },
    {
      id: "variance",
      header: "فرق الدرج",
      cell: ({ row }) => formatCurrency(row.original.totalVariance, currency),
    },
  ];

  return (
    <ReportPage
      title="أداء الكاشير"
      description="الطلبات والإيراد ومتوسط التذكرة وفرق الجلسات المغلقة"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportCashiersReportExcel(
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
        <ReportFiltersBar basePath="/reports/cashiers" filters={filters} options={{ stores }} />
      }
    >
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "الإيراد",
            value: formatCurrency(totalRevenue, currency),
            icon: <TrendingUp className="size-5" />,
          },
          {
            label: "الطلبات",
            value: String(totalOrders),
            icon: <Receipt className="size-5" />,
          },
          {
            label: "الكاشيرين",
            value: String(rows.length),
            icon: <Users className="size-5" />,
          },
          {
            label: "إجمالي فرق الدرج",
            value: formatCurrency(totalVariance, currency),
            icon: <Scale className="size-5" />,
          },
        ]}
      />
      <ReportTable title="تفصيل الكاشير" columns={columns} data={rows} />
    </ReportPage>
  );
}
