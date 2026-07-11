"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Package, AlertTriangle, Boxes } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportInventoryReportExcel } from "@/modules/reports/actions/inventory-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { reportFiltersToSearchParams, type ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { InventoryKpi } from "@/modules/reports/services/inventory-report.service";
import type { Store } from "@/lib/types";
import type { ExpiryBatchRow } from "@/lib/repositories/report.repository";

interface InventoryReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  kpi: InventoryKpi;
  valuation: { productId: string; productName: string; quantity: number; unitCost: number; totalValue: number }[];
  expiryBatches: ExpiryBatchRow[];
  nearExpiry: ExpiryBatchRow[];
  expired: ExpiryBatchRow[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function InventoryReportView({
  filters,
  stores,
  currency,
  kpi,
  valuation,
  expiryBatches,
  nearExpiry,
  expired,
  canPrint,
  canExcel,
  canPdf,
}: InventoryReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/inventory${printQs ? `?${printQs}` : ""}`;

  const valuationColumns: ColumnDef<(typeof valuation)[number]>[] = [
    { header: "المنتج", accessorKey: "productName" },
    { header: "الكمية", accessorKey: "quantity" },
    {
      id: "totalValue",
      header: "القيمة",
      cell: ({ row }) => formatCurrency(row.original.totalValue, currency),
    },
  ];

  const expiryColumns: ColumnDef<ExpiryBatchRow>[] = [
    { header: "المنتج", accessorKey: "productName" },
    { header: "التشغيلة", accessorKey: "batchNumber" },
    { header: "الانتهاء", accessorKey: "expiryDate" },
    { header: "الكمية", accessorKey: "remainingQuantity" },
    { header: "الأيام", accessorKey: "daysUntilExpiry" },
  ];

  return (
    <ReportPage
      title="تقرير المخزون"
      description="التقييم والتشغيلات والانتهاء والهالك"
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
                const result = await exportInventoryReportExcel(
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
      filters={<ReportFiltersBar basePath="/reports/inventory" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        items={[
          { label: "قيمة المخزون", value: formatCurrency(kpi.valuationEstimate, currency), icon: <Package className="size-5" /> },
          { label: "أصناف مخزون منخفض", value: String(kpi.lowStockCount), icon: <AlertTriangle className="size-5" /> },
          { label: "قريب من الانتهاء", value: String(nearExpiry.length), icon: <Boxes className="size-5" /> },
          { label: "تشغيلات منتهية", value: String(expired.length), icon: <AlertTriangle className="size-5" /> },
        ]}
      />
      <ReportTable title="تقييم المخزون" columns={valuationColumns} data={valuation.slice(0, 50)} />
      <ReportTable title="الانتهاء والتشغيلات" columns={expiryColumns} data={expiryBatches.slice(0, 50)} />
    </ReportPage>
  );
}
