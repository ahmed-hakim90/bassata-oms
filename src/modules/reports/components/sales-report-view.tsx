"use client";

import { useTransition } from "react";
import Link from "next/link";
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
import {
  Building2,
  DollarSign,
  Package,
  Receipt,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ModuleAnalyticsQuickLinks } from "@/modules/reports/components/module-analytics-quick-links";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportSalesReportExcel } from "@/modules/reports/actions/sales-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";

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
  topProducts: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  revenueByStore: {
    storeId: string;
    storeName: string;
    revenue: number;
  }[];
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
  summary,
  revenueByDay,
  topProducts,
  revenueByStore,
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
  const entityQs = reportFiltersToSearchParams({
    from: filters.from,
    to: filters.to,
    days: filters.days,
    storeId: filters.storeId,
  });
  const withQs = (path: string) => (entityQs ? `${path}?${entityQs}` : path);

  const orderColumns: ColumnDef<Order>[] = [
    { header: "الطلب", accessorKey: "order_number" },
    {
      id: "total",
      header: "الإجمالي",
      cell: ({ row }) => formatCurrency(row.original.total, currency),
    },
    { header: "الحالة", accessorKey: "status" },
    {
      id: "created_at",
      header: "التاريخ",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
  ];

  const productColumns: ColumnDef<(typeof topProducts)[number]>[] = [
    {
      id: "name",
      header: "المنتج",
      cell: ({ row }) => (
        <Link
          href={`/reports/sales/product?productId=${row.original.id}${
            entityQs ? `&${entityQs}` : ""
          }`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "qty",
      header: "الكمية",
      cell: ({ row }) => row.original.quantity.toLocaleString("ar-EG"),
    },
    {
      id: "revenue",
      header: "الإيراد",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
  ];

  const chartData = revenueByDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  const storeChart = revenueByStore
    .filter((s) => s.revenue > 0)
    .map((s) => ({
      label: s.storeName.length > 12 ? `${s.storeName.slice(0, 12)}…` : s.storeName,
      revenue: s.revenue,
      storeId: s.storeId,
    }));

  return (
    <ReportPage
      title="تقرير المبيعات"
      description="لوحة المبيعات: إيراد، اتجاهات، أصناف، وتقارير مصغّرة"
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

      <ModuleAnalyticsQuickLinks
        title="تقارير مصغّرة"
        description="افتح تحليل لكيان واحد بسرعة"
        links={[
          {
            href: withQs("/reports/sales/product"),
            label: "مبيعات منتج",
            description: "كمية وإيراد صنف واحد",
            icon: Package,
          },
          {
            href: withQs("/reports/sales/branch"),
            label: "ملخص فرع",
            description: "إيراد وأصناف وموظفين لفرع",
            icon: Building2,
          },
          {
            href: withQs("/reports/sales/cashier"),
            label: "ملخص موظف",
            description: "أداء كاشير: إيراد وجلسات",
            icon: UserRound,
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

      {storeChart.length > 1 ? (
        <ReportChartSection title="الإيراد حسب الفرع" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storeChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <ReportTable
        title="أفضل الأصناف"
        columns={productColumns}
        data={topProducts}
        emptyMessage="مفيش أصناف في الفترة"
      />

      <ReportTable
        title="آخر الطلبات"
        columns={orderColumns}
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
