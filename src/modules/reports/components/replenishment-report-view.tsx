"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageMinus, PackagePlus, ShoppingCart, CalendarRange } from "lucide-react";
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
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportReplenishmentReportExcel } from "@/modules/reports/actions/replenishment-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type {
  ReplenishmentReport,
  ReplenishmentRow,
} from "@/modules/reports/services/replenishment-report.service";
import type { Store } from "@/lib/types";
import { selectLabelById } from "@/lib/select-label";

interface ReplenishmentReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: ReplenishmentReport;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 3 });
}

export function ReplenishmentReportView({
  filters,
  stores,
  report,
  canPrint,
  canExcel,
  canPdf,
}: ReplenishmentReportViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/replenishment${printQs ? `?${printQs}` : ""}`;

  const apply = (next: Partial<ReportFilters>) => {
    const qs = reportFiltersToSearchParams({ ...filters, ...next, page: 1 });
    router.push(qs ? `/reports/replenishment?${qs}` : "/reports/replenishment");
  };

  const columns: ColumnDef<ReplenishmentRow>[] = [
    {
      header: "الصنف",
      accessorKey: "productName",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.productName}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.sku || "—"} · {row.original.unitLabel} ·{" "}
            {row.original.source === "ingredient" ? "خامة وصفة" : "منتج مباع"}
          </p>
        </div>
      ),
    },
    {
      header: "استهلاك الشهر",
      id: "monthUsage",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatQty(row.original.monthUsage)}</span>
      ),
    },
    {
      header: `مطلوب ×${report.coverageMonths}`,
      id: "required",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatQty(row.original.requiredQty)}</span>
      ),
    },
    {
      header: "الرصيد",
      id: "onHand",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatQty(row.original.onHand)}</span>
      ),
    },
    {
      header: "مقترح شراء",
      id: "buy",
      cell: ({ row }) => (
        <span
          className={
            row.original.suggestedBuy > 0
              ? "font-semibold tabular-nums text-amber-700 dark:text-amber-400"
              : "tabular-nums text-muted-foreground"
          }
        >
          {formatQty(row.original.suggestedBuy)}
        </span>
      ),
    },
    {
      header: "يكفي (يوم)",
      id: "days",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.daysCover == null ? "—" : formatQty(row.original.daysCover)}
        </span>
      ),
    },
  ];

  return (
    <ReportPage
      title="خطة الشراء من المبيعات"
      description={`بناءً على مبيعات ${report.monthLabel} (من أول يوم لآخر يوم) — اختر كم شهر تغطية محتاج`}
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
                const result = await exportReplenishmentReportExcel(
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
        <div className="flex flex-wrap items-end gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
          <div className="space-y-1.5">
            <Label htmlFor="replenishment-month">شهر المبيعات</Label>
            <Input
              id="replenishment-month"
              type="month"
              className="min-h-11 w-[11rem]"
              value={report.month}
              onChange={(e) => {
                const month = e.target.value;
                if (month) apply({ month });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>التغطية المطلوبة</Label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((months) => (
                <Button
                  key={months}
                  type="button"
                  size="sm"
                  className="min-h-11 rounded-[var(--mds-radius-md)]"
                  variant={report.coverageMonths === months ? "default" : "outline"}
                  onClick={() => apply({ coverageMonths: months })}
                >
                  {months === 1 ? "شهر" : months === 2 ? "شهرين" : "3 شهور"}
                </Button>
              ))}
            </div>
          </div>

          {stores.length > 1 ? (
            <div className="space-y-1.5">
              <Label>الفرع</Label>
              <Select
                value={filters.storeId ?? "all"}
                onValueChange={(v) =>
                  apply({ storeId: !v || v === "all" ? undefined : v })
                }
              >
                <SelectTrigger className="min-h-11 w-[12rem]">
                  <SelectValue placeholder="كل الفروع">
                    {(value) =>
                      value === "all"
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
      <ReportKpiGrid
        items={[
          {
            label: "شهر الأساس",
            value: report.monthLabel,
            icon: <CalendarRange className="size-5" />,
          },
          {
            label: "طلبات مكتملة",
            value: String(report.orderCount),
            icon: <ShoppingCart className="size-5" />,
          },
          {
            label: "أصناف مستهلكة",
            value: String(report.summary.skuCount),
            icon: <PackageMinus className="size-5" />,
          },
          {
            label: "محتاج شراء",
            value: String(report.summary.needBuyCount),
            icon: <PackagePlus className="size-5" />,
          },
        ]}
      />

      <p className="rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        المطلوب = استهلاك الشهر × {report.coverageMonths}. مقترح الشراء = المطلوب −
        الرصيد الحالي. الأصناف اللي عليها وصفة بتتحسب كخامات؛ المنتجات المتتبعة من
        غير وصفة بتتحسب كصنف مباع.
      </p>

      <ReportTable
        title="خطة الشراء"
        columns={columns}
        data={report.rows}
        emptyMessage="مفيش مبيعات مكتملة في الشهر ده"
      />
    </ReportPage>
  );
}
