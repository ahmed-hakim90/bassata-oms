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
import { DollarSign, Receipt, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportSalesReportExcel } from "@/modules/reports/actions/sales-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import { useRouter } from "next/navigation";

interface SalesReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  summary: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
  } | null;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  orders: Order[];
  totalOrders: number;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function SalesReportView({
  filters,
  stores,
  currency,
  context,
  summary,
  revenueByDay,
  orders,
  totalOrders,
  canPrint,
  canExcel,
  canPdf,
}: SalesReportViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/sales${printQs ? `?${printQs}` : ""}`;

  const columns: ColumnDef<Order>[] = [
    { header: "الطلب", accessorKey: "order_number" },
    {
      header: "الإجمالي",
      cell: ({ row }) => formatCurrency(row.original.total, currency),
    },
    { header: "الحالة", accessorKey: "status" },
    {
      header: "التاريخ",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
  ];

  const chartData = revenueByDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <ReportPage
      title="تقرير المبيعات"
      description="الإيراد والطلبات وأداء الدفع"
      actions={
        <ExportButtonGroup
          printHref={canPrint ? printHref : undefined}
          canPrint={canPrint}
          canExcel={canExcel}
          canPdf={canPdf}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportSalesReportExcel(
                  Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [k, v === undefined ? undefined : String(v)])
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
        <ReportFiltersBar
          basePath="/reports/sales"
          filters={filters}
          options={{ stores, showPaymentMethod: true }}
        />
      }
    >
      <ReportKpiGrid
        items={[
          {
            label: "الإيراد",
            value: formatCurrency(summary?.totalRevenue ?? 0, currency),
            icon: <DollarSign className="size-5" />,
          },
          {
            label: "الطلبات",
            value: String(summary?.orderCount ?? 0),
            icon: <Receipt className="size-5" />,
          },
          {
            label: "متوسط الطلب",
            value: formatCurrency(summary?.avgOrderValue ?? 0, currency),
            icon: <TrendingUp className="size-5" />,
          },
        ]}
      />

      <ReportChartSection title="الإيراد حسب اليوم">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportChartSection>

      <ReportTable
        title="آخر الطلبات"
        columns={columns}
        data={orders}
        page={filters.page}
        pageSize={filters.pageSize}
        total={totalOrders}
        onPageChange={(page) => {
          const qs = reportFiltersToSearchParams({ ...filters, page });
          router.push(`/reports/sales?${qs}`);
        }}
      />
    </ReportPage>
  );
}
