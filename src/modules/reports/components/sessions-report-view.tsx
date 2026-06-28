"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, AlertTriangle, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportSessionsReportExcel } from "@/modules/reports/actions/session-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { reportFiltersToSearchParams, type ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { SessionKpi } from "@/modules/reports/services/session-report.service";
import type { Store } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface SessionsReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  kpi: SessionKpi;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function SessionsReportView({
  filters,
  stores,
  currency,
  context,
  kpi,
  canPrint,
  canExcel,
  canPdf,
}: SessionsReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/sessions${printQs ? `?${printQs}` : ""}`;

  const columns: ColumnDef<SessionKpi["recentSessions"][number]>[] = [
    { header: "الكاشير", accessorKey: "cashierName" },
    { header: "الفرع", accessorKey: "storeName" },
    { header: "تم الفتح", accessorKey: "openedAt" },
    {
      header: "الفرق",
      cell: ({ row }) =>
        row.original.variance != null
          ? formatCurrency(row.original.variance, currency)
          : "—",
    },
    { header: "الحالة", accessorKey: "status" },
    {
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/print/sessions/${row.original.id}/closing`}
          className="text-sm text-primary hover:underline"
        >
          الإغلاق
        </Link>
      ),
    },
  ];

  return (
    <ReportPage
      title="تقرير الجلسات"
      description="ورديات الكاشير والفروقات والتسوية"
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
                const result = await exportSessionsReportExcel(
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
        <ReportFiltersBar basePath="/reports/sessions" filters={filters} options={{ stores }} />
      }
    >
      <ReportKpiGrid
        items={[
          { label: "الجلسات المفتوحة", value: String(kpi.openSessions), icon: <Clock className="size-5" /> },
          { label: "الجلسات المغلقة", value: String(kpi.closedSessions), icon: <Users className="size-5" /> },
          {
            label: "إجمالي الفرق",
            value: formatCurrency(kpi.totalVariance, currency),
            icon: <AlertTriangle className="size-5" />,
          },
          {
            label: "متوسط الفرق",
            value: formatCurrency(kpi.avgVariance, currency),
            icon: <AlertTriangle className="size-5" />,
          },
        ]}
      />
      <ReportTable title="آخر الجلسات" columns={columns} data={kpi.recentSessions} />
    </ReportPage>
  );
}
