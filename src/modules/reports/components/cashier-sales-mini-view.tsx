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
import { DollarSign, Receipt, Scale, TrendingUp } from "lucide-react";
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
import { exportCashierSalesMiniExcel } from "@/modules/reports/actions/sales-entity-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { CashierSalesMiniReport } from "@/modules/reports/services/sales-entity-report.service";

interface CashierOption {
  id: string;
  name: string;
  role: string;
}

interface CashierSalesMiniViewProps {
  filters: ReportFilters;
  stores: Store[];
  cashiers: CashierOption[];
  currency: string;
  context: ReportContext;
  report: CashierSalesMiniReport | null;
  canExcel: boolean;
}

export function CashierSalesMiniView({
  filters,
  stores,
  cashiers,
  currency,
  report,
  canExcel,
}: CashierSalesMiniViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/sales/cashier?${qs}` : "/reports/sales/cashier");
  };

  const productColumns: ColumnDef<CashierSalesMiniReport["topProducts"][number]>[] = [
    {
      id: "name",
      header: "المنتج",
      cell: ({ row }) => (
        <Link
          href={`/reports/sales/product?productId=${row.original.productId}`}
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

  return (
    <ReportPage
      title="ملخص موظف"
      description="إيراد وطلبات وجلسات وأصناف لكاشير أو موظف واحد"
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
                  const result = await exportCashierSalesMiniExcel(
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
          <div className="min-w-[14rem] space-y-1">
            <Label>الموظف</Label>
            <Select
              value={filters.cashierId ?? "__unset"}
              onValueChange={(v) =>
                apply({ cashierId: !v || v === "__unset" ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر موظف…">
                  {(value) =>
                    !value || value === "__unset"
                      ? "اختر موظف…"
                      : selectLabelById(cashiers, value, (c) => c.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset" label="اختر موظف…">
                  اختر موظف…
                </SelectItem>
                {cashiers.map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {stores.length > 1 ? (
            <div className="min-w-[12rem] space-y-1">
              <Label>الفرع</Label>
              <Select
                value={filters.storeId ?? "all"}
                onValueChange={(v) =>
                  apply({ storeId: !v || v === "all" ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      !value || value === "all"
                        ? "كل الفروع"
                        : selectLabelById(stores, value, (s) => s.name)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="كل الفروع">
                    كل الفروع
                  </SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} label={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      }
    >
      {!report ? (
        <EmptyStateBlock
          title="اختار موظف"
          description="اختار كاشير أو موظف عشان تشوف ملخص أدائه"
        />
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
                label: "فرق الدرج",
                value: formatCurrency(report.totalVariance, currency),
                icon: <Scale className="size-5" />,
              },
            ]}
          />

          <ReportKpiGrid
            columns={2}
            items={[
              {
                label: "جلسات",
                value: String(report.sessionCount),
              },
              {
                label: "جلسات مغلقة",
                value: String(report.closedSessionCount),
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
                <Bar dataKey="revenue" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>

          <ReportTable
            title="أصناف باعها"
            columns={productColumns}
            data={report.topProducts}
            emptyMessage="مفيش أصناف في الفترة"
          />
        </>
      )}
    </ReportPage>
  );
}
