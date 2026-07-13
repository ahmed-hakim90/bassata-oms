"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Percent, Receipt, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportTaxReportExcel } from "@/modules/reports/actions/tax-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { TaxDayRow, TaxReport } from "@/modules/reports/services/tax-report.service";
import type { Store } from "@/lib/types";

interface TaxReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: TaxReport;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function TaxReportView({
  filters,
  stores,
  currency,
  report,
  canPrint,
  canExcel,
  canPdf,
}: TaxReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/tax${printQs ? `?${printQs}` : ""}`;
  const ratePct = report.taxRate <= 1 ? report.taxRate * 100 : report.taxRate;

  const dayColumns: ColumnDef<TaxDayRow>[] = [
    { header: "اليوم", accessorKey: "date" },
    { header: "الطلبات", accessorKey: "orderCount" },
    {
      header: "الأساس الخاضع",
      id: "base",
      cell: ({ row }) => formatCurrency(row.original.taxableBase, currency),
    },
    {
      header: "الضريبة",
      id: "tax",
      cell: ({ row }) => formatCurrency(row.original.tax, currency),
    },
    {
      header: "الإجمالي",
      id: "total",
      cell: ({ row }) => formatCurrency(row.original.total, currency),
    },
  ];

  return (
    <ReportPage
      title="تقرير الضريبة"
      description="ضريبة المبيعات المحصّلة من الطلبات المكتملة — جاهز للتصدير"
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
                const result = await exportTaxReportExcel(
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
          basePath="/reports/tax"
          filters={filters}
          options={{ stores, showDaysPresets: true }}
        />
      }
    >
      <ReportKpiGrid
        items={[
          {
            label: "نسبة الضريبة",
            value: `${ratePct.toFixed(ratePct % 1 === 0 ? 0 : 2)}%${
              report.taxInclusive ? " (شامل)" : " (إضافي)"
            }`,
            icon: <Percent className="size-5" />,
          },
          {
            label: "الأساس الخاضع",
            value: formatCurrency(report.summary.taxableBase, currency),
            icon: <Wallet className="size-5" />,
          },
          {
            label: "الضريبة المحصّلة",
            value: formatCurrency(report.summary.taxCollected, currency),
            icon: <Receipt className="size-5" />,
          },
          {
            label: "إجمالي المبيعات",
            value: formatCurrency(report.summary.grossSales, currency),
            icon: <Wallet className="size-5" />,
          },
        ]}
      />

      {!report.taxEnabled && report.summary.taxCollected === 0 ? (
        <p className="rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          الضريبة غير مفعّلة حالياً أو نسبة صفر — التقرير يعرض قيم `orders.tax`
          المحفوظة عند الإكمال.
        </p>
      ) : null}

      <ReportTable
        title="الضريبة حسب اليوم"
        columns={dayColumns}
        data={report.byDay}
        emptyMessage="لا توجد طلبات في الفترة"
      />
    </ReportPage>
  );
}
