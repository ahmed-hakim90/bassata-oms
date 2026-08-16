"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
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
import { DollarSign, Package, Receipt, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import type { Store } from "@/lib/types";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportTable } from "@/modules/reports/components/report-table";
import { exportBranchSalesMiniExcel } from "@/modules/reports/actions/sales-entity-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { BranchSalesMiniReport } from "@/modules/reports/services/sales-entity-report.service";
import type { CashierPerformanceRow } from "@/modules/reports/services/executive-analytics.service";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  wallet: "محفظة",
  other: "أخرى",
  credit: "آجل",
};

interface BranchSalesMiniViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: BranchSalesMiniReport | null;
  canExcel: boolean;
}

export function BranchSalesMiniView({
  filters,
  stores,
  currency,
  report,
  canExcel,
}: BranchSalesMiniViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/sales/branch?${qs}` : "/reports/sales/branch");
  };

  const productColumns: ColumnDef<BranchSalesMiniReport["topProducts"][number]>[] = [
    {
      id: "name",
      header: "المنتج",
      cell: ({ row }) =>
        row.original.productId ? (
          <Link
            href={`/reports/sales/product?productId=${row.original.productId}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ) : (
          row.original.name
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

  const cashierColumns: ColumnDef<CashierPerformanceRow>[] = [
    {
      id: "name",
      header: "الموظف",
      cell: ({ row }) => (
        <Link
          href={`/reports/sales/cashier?cashierId=${row.original.cashierId}${
            filters.storeId ? `&storeId=${filters.storeId}` : ""
          }`}
          className="font-medium hover:underline"
        >
          {row.original.cashierName}
        </Link>
      ),
    },
    { header: "طلبات", accessorKey: "orderCount" },
    {
      id: "revenue",
      header: "الإيراد",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "variance",
      header: "فرق الدرج",
      cell: ({ row }) => formatCurrency(row.original.totalVariance, currency),
    },
  ];

  return (
    <ReportPage
      title="ملخص فرع"
      description="إيراد وأصناف وموظفين وطرق دفع لفرع واحد"
      actions={
        report ? (
          <ExportButtonGroup
            canPrint={false}
            canExcel={canExcel}
            canPdf={false}
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const result = await exportBranchSalesMiniExcel(
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
        ) : undefined
      }
      filters={
        <div className="flex flex-wrap items-end gap-[var(--mds-space-3)]">
          <div className="flex gap-[var(--mds-space-2)]">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={filters.days === days && !filters.from ? "default" : "outline"}
                onClick={() => apply({ days, from: undefined, to: undefined })}
              >
                {days} يوم
              </Button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              apply({
                from: fd.get("from")?.toString() || undefined,
                to: fd.get("to")?.toString() || undefined,
                days: undefined,
              });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="from">من</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">إلى</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              تطبيق
            </Button>
          </form>
          <div className="min-w-[12rem] space-y-1">
            <Label>الفرع</Label>
            <Select
              value={filters.storeId ?? stores[0]?.id ?? "__unset"}
              onValueChange={(v) => apply({ storeId: v || undefined })}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name) ?? "اختر فرع…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {!report ? (
        <EmptyStateBlock title="مفيش فرع" description="أضف فرع أولًا من الإعدادات" />
      ) : (
        <>
          <ReportKpiGrid
            items={[
              {
                label: "الإيراد",
                value: formatCurrency(report.totalRevenue, currency),
                icon: <DollarSign className="size-5" />,
              },
              {
                label: "الطلبات",
                value: String(report.orderCount),
                icon: <Receipt className="size-5" />,
              },
              {
                label: "متوسط الطلب",
                value: formatCurrency(report.avgOrderValue, currency),
                icon: <TrendingUp className="size-5" />,
              },
              {
                label: "موظفين نشطين",
                value: String(report.cashiers.length),
                icon: <Users className="size-5" />,
              },
            ]}
          />

          <ReportChartSection title="الإيراد حسب اليوم">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.revenueByDay.map((d) => ({
                  ...d,
                  label: d.date.slice(5),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>

          {report.paymentMix.length > 0 ? (
            <ReportChartSection title="توزيع طرق الدفع" height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.paymentMix.map((p) => ({
                    label: PAYMENT_LABELS[p.method] ?? p.method,
                    amount: p.amount,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ReportChartSection>
          ) : null}

          <ReportTable
            title="أفضل الأصناف"
            columns={productColumns}
            data={report.topProducts}
            emptyMessage="مفيش أصناف في الفترة"
          />
          <ReportTable
            title="أداء الموظفين"
            columns={cashierColumns}
            data={report.cashiers}
            emptyMessage="مفيش جلسات/مبيعات موظفين"
          />
          <p className="text-sm text-muted-foreground">
            <Package className="mr-1 inline size-3.5" />
            فرع {report.storeName} · اضغط المنتج أو الموظف للتقرير المصغّر
          </p>
        </>
      )}
    </ReportPage>
  );
}
