"use client";

import { useTransition } from "react";
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
import { Building2, Package, Receipt, TrendingUp, Users } from "lucide-react";
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
import { exportProductSalesMiniExcel } from "@/modules/reports/actions/sales-entity-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { ProductSalesMiniReport } from "@/modules/reports/services/sales-entity-report.service";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface ProductSalesMiniViewProps {
  filters: ReportFilters;
  stores: Store[];
  products: ProductOption[];
  currency: string;
  context: ReportContext;
  report: ProductSalesMiniReport | null;
  canExcel: boolean;
}

export function ProductSalesMiniView({
  filters,
  stores,
  products,
  currency,
  report,
  canExcel,
}: ProductSalesMiniViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/sales/product?${qs}` : "/reports/sales/product");
  };

  const storeColumns: ColumnDef<ProductSalesMiniReport["byStore"][number]>[] = [
    { header: "الفرع", accessorKey: "storeName" },
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
    { header: "طلبات", accessorKey: "orders" },
  ];

  const cashierColumns: ColumnDef<ProductSalesMiniReport["byCashier"][number]>[] = [
    {
      id: "name",
      header: "الموظف",
      cell: ({ row }) => (
        <a
          href={`/reports/sales/cashier?cashierId=${row.original.cashierId}`}
          className="font-medium hover:underline"
        >
          {row.original.cashierName}
        </a>
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
      title="مبيعات منتج"
      description="كمية وإيراد صنف واحد حسب الأيام والفروع والموظفين"
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
                  const result = await exportProductSalesMiniExcel(
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
            <Label>المنتج</Label>
            <Select
              value={filters.productId ?? "__unset"}
              onValueChange={(v) =>
                apply({ productId: !v || v === "__unset" ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر منتج…">
                  {(value) =>
                    !value || value === "__unset"
                      ? "اختر منتج…"
                      : selectLabelById(products, value, (p) =>
                          p.sku ? `${p.name} · ${p.sku}` : p.name
                        )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset" label="اختر منتج…">
                  اختر منتج…
                </SelectItem>
                {products.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    label={p.sku ? `${p.name} · ${p.sku}` : p.name}
                  >
                    {p.sku ? `${p.name} · ${p.sku}` : p.name}
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
          title="اختار منتج"
          description="اختار صنف عشان تشوف مبيعاته بالتفصيل"
        />
      ) : (
        <>
          <ReportKpiGrid
            items={[
              {
                label: "الإيراد",
                value: formatCurrency(report.totalRevenue, currency),
                icon: <TrendingUp className="size-5" />,
              },
              {
                label: "الكمية",
                value: report.totalQuantity.toLocaleString("ar-EG"),
                icon: <Package className="size-5" />,
              },
              {
                label: "طلبات فيها الصنف",
                value: String(report.orderCount),
                icon: <Receipt className="size-5" />,
              },
              {
                label: "متوسط للطلب",
                value: formatCurrency(report.avgLineRevenue, currency),
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
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartSection>

          <ReportTable
            title="حسب الفرع"
            columns={storeColumns}
            data={report.byStore}
            emptyMessage="مفيش مبيعات للفروع في الفترة"
          />
          <ReportTable
            title="حسب الموظف"
            columns={cashierColumns}
            data={report.byCashier}
            emptyMessage="مفيش مبيعات للموظفين في الفترة"
          />
          <p className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" /> {report.productName}
              {report.sku ? ` · ${report.sku}` : ""}
            </span>
            <a href="/reports/product-card" className="text-primary hover:underline">
              كارت مخزون الصنف
            </a>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> تفصيل الموظف من الجدول
            </span>
          </p>
        </>
      )}
    </ReportPage>
  );
}
