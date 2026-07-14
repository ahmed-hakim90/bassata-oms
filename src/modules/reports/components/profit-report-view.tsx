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
import {
  CircleDollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  Trash2,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportProfitReportExcel } from "@/modules/reports/actions/profit-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type {
  DayProfitRow,
  InvoiceProfitRow,
  ProductProfitRow,
  PurchaseInvoiceProfitRow,
} from "@/modules/reports/services/profit-report.service";

interface ProfitReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  profit: Awaited<
    ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProfitReport>
  >;
  rankings: Awaited<
    ReturnType<
      typeof import("@/modules/reports/services/profit-report.service").productRankingsFromReport
    >
  >;
  outstanding: { id: string; name: string; account_balance: number }[];
  supplierBalances: { id: string; name: string; balanceDue: number }[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function ProfitReportView({
  filters,
  stores,
  currency,
  profit,
  rankings,
  outstanding,
  supplierBalances,
  canPrint,
  canExcel,
  canPdf,
}: ProfitReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/profit${printQs ? `?${printQs}` : ""}`;

  const invoiceColumns: ColumnDef<InvoiceProfitRow>[] = [
    { header: "فاتورة البيع", accessorKey: "orderNumber" },
    {
      id: "createdAt",
      header: "التاريخ",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString("ar-EG"),
    },
    {
      id: "revenue",
      header: "المبيعات",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: "التكلفة",
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
    },
    {
      id: "profit",
      header: "الربح المتوقع",
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: "الهامش %",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const purchaseInvoiceColumns: ColumnDef<PurchaseInvoiceProfitRow>[] = [
    { header: "فاتورة الشراء", accessorKey: "invoiceNumber" },
    {
      id: "receivedAt",
      header: "تاريخ الاستلام",
      cell: ({ row }) => new Date(row.original.receivedAt).toLocaleString("ar-EG"),
    },
    {
      id: "purchaseCost",
      header: "تكلفة الشراء",
      cell: ({ row }) => formatCurrency(row.original.purchaseCost, currency),
    },
    {
      id: "expectedSellValue",
      header: "قيمة البيع المتوقعة",
      cell: ({ row }) => formatCurrency(row.original.expectedSellValue, currency),
    },
    {
      id: "expectedProfit",
      header: "الربح المتوقع",
      cell: ({ row }) => formatCurrency(row.original.expectedProfit, currency),
    },
    {
      id: "margin",
      header: "الهامش %",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const dayColumns: ColumnDef<DayProfitRow>[] = [
    { header: "اليوم", accessorKey: "date" },
    { header: "فواتير", accessorKey: "orders" },
    {
      id: "revenue",
      header: "المبيعات",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: "التكلفة",
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
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
  ];

  const productColumns: ColumnDef<ProductProfitRow>[] = [
    { header: "الصنف", accessorKey: "name" },
    {
      id: "qty",
      header: "الكمية",
      cell: ({ row }) => row.original.quantitySold.toLocaleString("ar-EG"),
    },
    {
      id: "revenue",
      header: "المبيعات",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: "التكلفة",
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
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
  ];

  const chartData = profit.byDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <ReportPage
      title="تقرير الأرباح"
      description="ربح كل فاتورة، إجماليات الأيام والأصناف، وربح المخزون المتوقع"
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
                const result = await exportProfitReportExcel(
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
      filters={<ReportFiltersBar basePath="/reports/profit" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={4}
        items={[
          {
            label: "الإيراد",
            value: formatCurrency(profit.revenue, currency),
            icon: <TrendingUp className="size-5" />,
          },
          {
            label: "تكلفة البضاعة",
            value: formatCurrency(profit.cogs, currency),
            icon: <TrendingDown className="size-5" />,
          },
          {
            label: "إجمالي الربح",
            value: formatCurrency(profit.grossProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          {
            label: "صافي الربح",
            value: formatCurrency(profit.estimatedNetProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          { label: "المصروفات", value: formatCurrency(profit.totalExpenses, currency) },
          {
            label: "تكلفة الهالك",
            value: formatCurrency(profit.wasteCost, currency),
            icon: <Trash2 className="size-5" />,
          },
          {
            label: "متوسط ربح الفاتورة",
            value: formatCurrency(profit.avgOrderProfit, currency),
            icon: <Receipt className="size-5" />,
          },
          {
            label: "ربح متوقع من المخزون",
            value: formatCurrency(profit.inventory.inventoryExpectedProfit, currency),
            icon: <Package className="size-5" />,
          },
        ]}
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <OperationalCard title="مخزون — قيمة البيع">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventorySellValue, currency)}
          </p>
        </OperationalCard>
        <OperationalCard title="مخزون — تكلفة الشراء">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventoryCostValue, currency)}
          </p>
        </OperationalCard>
        <OperationalCard title="مخزون — ربح متوقع">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(profit.inventory.inventoryExpectedProfit, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">فرق البيع والشراء للكميات الحالية</p>
        </OperationalCard>
      </div>

      {chartData.length > 0 ? (
        <ReportChartSection title="الربح حسب اليوم">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
              />
              <Bar dataKey="profit" name="الربح" fill="var(--mds-color-action-primary)" radius={4} />
              <Bar dataKey="revenue" name="المبيعات" fill="var(--mds-color-harbor-300)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChartSection>
      ) : null}

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title="أعلى أصناف ربحًا في البيع">
          <ul className="space-y-2 text-sm">
            {rankings.highestProfit.map((p) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(p.profit, currency)}
                  <span className="text-muted-foreground"> ({p.margin.toFixed(0)}%)</span>
                </span>
              </li>
            ))}
            {rankings.highestProfit.length === 0 ? (
              <p className="text-muted-foreground">لا توجد مبيعات في الفترة</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title="أعلى أصناف بيعًا والربح منها">
          <ul className="space-y-2 text-sm">
            {rankings.highestSelling.map((p) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="text-end tabular-nums">
                  <span className="font-medium">{formatCurrency(p.revenue, currency)}</span>
                  <span className="block text-xs text-muted-foreground">
                    ربح {formatCurrency(p.profit, currency)}
                  </span>
                </span>
              </li>
            ))}
            {rankings.highestSelling.length === 0 ? (
              <p className="text-muted-foreground">لا توجد مبيعات في الفترة</p>
            ) : null}
          </ul>
        </OperationalCard>
      </div>

      <ReportTable
        title="الربح المتوقع لكل فاتورة بيع"
        columns={invoiceColumns}
        data={profit.invoices}
        emptyMessage="لا توجد فواتير بيع مكتملة في الفترة"
      />

      <ReportTable
        title="الربح المتوقع لكل فاتورة شراء"
        columns={purchaseInvoiceColumns}
        data={profit.purchaseInvoices}
        emptyMessage="لا توجد فواتير شراء مستلمة في الفترة"
      />

      <ReportTable
        title="إجماليات حسب اليوم"
        columns={dayColumns}
        data={[...profit.byDay].reverse()}
        emptyMessage="لا توجد أيام بمبيعات في الفترة"
      />

      <ReportTable
        title="إجماليات الأصناف (مبيعات وتكلفة وربح)"
        columns={productColumns}
        data={profit.products}
        emptyMessage="لا توجد أصناف مباعة في الفترة"
      />

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title="أرصدة العملاء الآجلة">
          <ul className="space-y-2 text-sm">
            {outstanding.slice(0, 8).map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums">
                  {formatCurrency(c.account_balance, currency)}
                </span>
              </li>
            ))}
            {outstanding.length === 0 ? (
              <p className="text-muted-foreground">لا توجد أرصدة</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title="أرصدة الموردين">
          <ul className="space-y-2 text-sm">
            {supplierBalances.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="tabular-nums">{formatCurrency(s.balanceDue, currency)}</span>
              </li>
            ))}
            {supplierBalances.length === 0 ? (
              <p className="text-muted-foreground">لا توجد أرصدة</p>
            ) : null}
          </ul>
        </OperationalCard>
        <OperationalCard title="المصروفات حسب مركز التكلفة">
          <ul className="space-y-2 text-sm">
            {profit.expensesByCostCenter.slice(0, 8).map((c) => (
              <li key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums">{formatCurrency(c.amount, currency)}</span>
              </li>
            ))}
            {profit.expensesByCostCenter.length === 0 ? (
              <p className="text-muted-foreground">لا توجد مصروفات</p>
            ) : null}
          </ul>
        </OperationalCard>
      </div>
    </ReportPage>
  );
}
