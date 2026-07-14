"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Scale,
  Warehouse,
} from "lucide-react";
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
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportProductStockCardExcel } from "@/modules/reports/actions/product-stock-card.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type {
  ProductStockCardLine,
  ProductStockCardReport,
} from "@/modules/reports/services/product-stock-card.service";
import { selectLabelById } from "@/lib/select-label";
import type { Store, Warehouse as WarehouseType } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unitLabel: string;
}

interface ProductStockCardViewProps {
  filters: ReportFilters;
  stores: Store[];
  warehouses: WarehouseType[];
  products: ProductOption[];
  currency: string;
  context: ReportContext;
  report: ProductStockCardReport | null;
  rangeDays: number;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-EG", {
    maximumFractionDigits: 4,
    numberingSystem: "latn",
  });
}

export function ProductStockCardView({
  filters,
  stores,
  warehouses,
  products,
  report,
  canPrint,
  canExcel,
  canPdf,
}: ProductStockCardViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/product-card${printQs ? `?${printQs}` : ""}`;

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/product-card?${qs}` : "/reports/product-card");
  };

  const columns: ColumnDef<ProductStockCardLine>[] = [
    {
      header: "التاريخ",
      id: "at",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-sm">
          {formatDateTime(row.original.at)}
        </span>
      ),
    },
    {
      header: "النوع",
      id: "type",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.movementTypeLabel}</p>
          <p className="text-xs text-muted-foreground">{row.original.bucketLabel}</p>
        </div>
      ),
    },
    {
      header: "جه",
      id: "in",
      cell: ({ row }) =>
        row.original.inQty > 0 ? (
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatQty(row.original.inQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "طلع",
      id: "out",
      cell: ({ row }) =>
        row.original.outQty > 0 ? (
          <span className="tabular-nums text-red-700 dark:text-red-400">
            {formatQty(row.original.outQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "اتساوى",
      id: "eq",
      cell: ({ row }) =>
        row.original.equalizeQty !== 0 ? (
          <span
            className={cn(
              "tabular-nums",
              row.original.equalizeQty > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-amber-800 dark:text-amber-300"
            )}
          >
            {row.original.equalizeQty > 0 ? "+" : ""}
            {formatQty(row.original.equalizeQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "الرصيد",
      id: "balance",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatQty(row.original.balance)}
        </span>
      ),
    },
    {
      header: "المخزن / السبب",
      id: "meta",
      cell: ({ row }) => (
        <div className="max-w-[14rem]">
          <p className="text-sm">{row.original.warehouseName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.reason || "—"}
          </p>
        </div>
      ),
    },
  ];

  const unitSuffix = report ? ` ${report.product.unitLabel}` : "";

  return (
    <ReportPage
      title="كارت صنف"
      description="رصيد افتتاحي، وارد، منصرف، تسوية، ومتاح — على الفترة اللي تختارها"
      actions={
        report ? (
          <ExportButtonGroup
            printHref={canPrint ? printHref : undefined}
            canPrint={canPrint}
            canExcel={canExcel}
            canPdf={canPdf}
            pending={pending}
            onExportExcel={() => {
              startTransition(async () => {
                try {
                  const result = await exportProductStockCardExcel(
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
                className="rounded-[var(--mds-radius-md)]"
                onClick={() => apply({ days, from: undefined, to: undefined })}
              >
                {days} يوم
              </Button>
            ))}
          </div>

          <form
            className="flex flex-wrap items-end gap-[var(--mds-space-2)]"
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
            <div className="space-y-[var(--mds-space-1)]">
              <Label htmlFor="from">من</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <div className="space-y-[var(--mds-space-1)]">
              <Label htmlFor="to">إلى</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={filters.to ?? ""}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              تطبيق الفترة
            </Button>
          </form>

          <div className="space-y-[var(--mds-space-1)]">
            <Label>الصنف</Label>
            <Select
              value={filters.productId ?? "__unset"}
              onValueChange={(v) =>
                apply({ productId: !v || v === "__unset" ? undefined : v })
              }
            >
              <SelectTrigger className="w-[220px] rounded-[var(--mds-radius-md)]">
                <SelectValue placeholder="اختر صنف…">
                  {(value) =>
                    !value || value === "__unset"
                      ? "اختر صنف…"
                      : selectLabelById(products, value, (p) => p.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset" label="اختر صنف…">
                  اختر صنف…
                </SelectItem>
                {products.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    مفيش أصناف متتبعة
                  </SelectItem>
                ) : (
                  products.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      label={p.sku ? `${p.name} · ${p.sku}` : p.name}
                    >
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {stores.length > 1 ? (
            <div className="space-y-[var(--mds-space-1)]">
              <Label>الفرع</Label>
              <Select
                value={filters.storeId ?? "all"}
                onValueChange={(v) =>
                  apply({
                    storeId: !v || v === "all" ? undefined : v,
                    warehouseId: undefined,
                  })
                }
              >
                <SelectTrigger className="w-[160px] rounded-[var(--mds-radius-md)]">
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

          <div className="space-y-[var(--mds-space-1)]">
            <Label>المخزن</Label>
            <Select
              value={filters.warehouseId ?? "all"}
              onValueChange={(v) =>
                apply({ warehouseId: !v || v === "all" ? undefined : v })
              }
            >
              <SelectTrigger className="w-[160px] rounded-[var(--mds-radius-md)]">
                <SelectValue>
                  {(value) =>
                    value === "all"
                      ? "كل المخازن"
                      : selectLabelById(warehouses, value, (w) => w.name)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="كل المخازن">
                  كل المخازن
                </SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id} label={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {!filters.productId || !report ? (
        <EmptyStateBlock
          title="اختار صنف عشان تشوف الكارت"
          description="حدّد الصنف والفترة — هيظهر الرصيد الافتتاحي، اللي جه، اللي طلع، التسوية، والمتاح."
        />
      ) : (
        <>
          <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card px-[var(--mds-space-4)] py-[var(--mds-space-3)] text-sm">
            <p className="font-semibold">{report.product.name}</p>
            <p className="text-muted-foreground">
              {report.product.sku ? `SKU ${report.product.sku} · ` : ""}
              الوحدة: {report.product.unitLabel}
              {report.warehouseName ? ` · مخزن ${report.warehouseName}` : " · كل المخازن"}
            </p>
          </div>

          <ReportKpiGrid
            columns={3}
            items={[
              {
                label: "بدانا بـ",
                value: `${formatQty(report.openingQty)}${unitSuffix}`,
                icon: <Package className="size-5" />,
              },
              {
                label: "جه",
                value: `${formatQty(report.totals.inQty)}${unitSuffix}`,
                icon: <ArrowDownToLine className="size-5" />,
                trend: "up",
              },
              {
                label: "طلع",
                value: `${formatQty(report.totals.outQty)}${unitSuffix}`,
                icon: <ArrowUpFromLine className="size-5" />,
                trend: "down",
              },
              {
                label: "اتساوى",
                value: `${report.totals.equalizeQty > 0 ? "+" : ""}${formatQty(report.totals.equalizeQty)}${unitSuffix}`,
                icon: <Scale className="size-5" />,
              },
              {
                label: "متاح (نهاية الفترة)",
                value: `${formatQty(report.closingQty)}${unitSuffix}`,
                icon: <Warehouse className="size-5" />,
              },
              {
                label: "رصيد حالي الآن",
                value: `${formatQty(report.onHandQty)}${unitSuffix}`,
                icon: <Package className="size-5" />,
              },
            ]}
          />

          <ReportTable
            title="حركة الصنف في الفترة"
            columns={columns}
            data={report.lines}
            emptyMessage="مفيش حركات للصنف ده في الفترة دي"
          />
        </>
      )}
    </ReportPage>
  );
}
