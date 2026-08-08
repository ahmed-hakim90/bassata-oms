"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Receipt, Trash2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportBranchesReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { BranchComparisonRow } from "@/modules/reports/services/executive-analytics.service";

interface BranchesReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  rows: BranchComparisonRow[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function BranchesReportView({
  filters,
  stores,
  currency,
  rows,
  canExcel,
}: BranchesReportViewProps) {
  const [pending, startTransition] = useTransition();

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const totalWaste = rows.reduce((s, r) => s + r.wasteCost, 0);

  const columns: ColumnDef<BranchComparisonRow>[] = [
    { header: "الفرع", accessorKey: "storeName" },
    {
      id: "revenue",
      header: "الإيراد",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "profit",
      header: "الربح",
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: "الهامش %",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
    { header: "الطلبات", accessorKey: "orderCount" },
    {
      id: "waste",
      header: "الهالك",
      cell: ({ row }) => formatCurrency(row.original.wasteCost, currency),
    },
  ];

  const chartData = rows.map((r) => ({
    name: r.storeName,
    revenue: r.revenue,
    profit: r.profit,
  }));

  return (
    <ReportPage
      title="مقارنة الفروع"
      description="الإيراد والربح وعدد الطلبات والهالك حسب الفرع"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportBranchesReportExcel(
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
        <ReportFiltersBar basePath="/reports/branches" filters={filters} options={{ stores }} />
      }
    >
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "إجمالي الإيراد",
            value: formatCurrency(totalRevenue, currency),
            icon: <TrendingUp className="size-5" />,
          },
          {
            label: "إجمالي الربح",
            value: formatCurrency(totalProfit, currency),
            icon: <Building2 className="size-5" />,
          },
          {
            label: "الطلبات",
            value: String(totalOrders),
            icon: <Receipt className="size-5" />,
          },
          {
            label: "الهالك",
            value: formatCurrency(totalWaste, currency),
            icon: <Trash2 className="size-5" />,
          },
        ]}
      />

      <ReportChartSection title="الإيراد والربح حسب الفرع">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" name="الإيراد" fill="#2563EB" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="الربح" fill="#16A34A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportChartSection>

      <ReportTable title="تفصيل الفروع" columns={columns} data={rows} />
    </ReportPage>
  );
}
