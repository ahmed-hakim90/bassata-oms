"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Clock,
  Landmark,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportDailyCloseReportExcel } from "@/modules/reports/actions/daily-close-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { DailyCloseReport } from "@/modules/reports/services/daily-close-report.service";
import type { Store } from "@/lib/types";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

interface DailyCloseReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: DailyCloseReport;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function DailyCloseReportView({
  filters,
  stores,
  currency,
  report,
  canPrint,
  canExcel,
  canPdf,
}: DailyCloseReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/daily-close${printQs ? `?${printQs}` : ""}`;
  const t = report.totals;

  const columns: ColumnDef<DailyCloseReport["sessions"][number]>[] = [
    { header: "الكاشير", accessorKey: "cashierName" },
    { header: "الفرع", accessorKey: "storeName" },
    {
      header: "المتوقع",
      id: "expected",
      cell: ({ row }) => formatCurrency(row.original.expectedCash, currency),
    },
    {
      header: "الفعلي",
      id: "actual",
      cell: ({ row }) =>
        row.original.actualCash != null
          ? formatCurrency(row.original.actualCash, currency)
          : "—",
    },
    {
      header: "الفرق",
      id: "variance",
      cell: ({ row }) =>
        row.original.variance != null
          ? formatCurrency(row.original.variance, currency)
          : "—",
    },
    {
      id: "closing",
      header: "إغلاق الجلسة",
      cell: ({ row }) => (
        <Link
          href={`/print/sessions/${row.original.id}/closing`}
          className="text-sm text-primary hover:underline"
        >
          عرض
        </Link>
      ),
    },
  ];

  return (
    <ReportPage
      title="إقفال اليوم"
      description="نقدية اليوم: المتوقع والفعلي والفرق — مطابق لإغلاق الجلسة"
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
                const result = await exportDailyCloseReportExcel(
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
          basePath="/reports/daily-close"
          filters={filters}
          options={{ stores, showDaysPresets: true }}
        />
      }
    >
      <ReportKpiGrid
        items={[
          {
            label: "جلسات مغلقة",
            value: String(report.closedCount),
            icon: <Clock className="size-5" />,
          },
          {
            label: "نقدية متوقعة",
            value: formatCurrency(t.expectedCash, currency),
            icon: <Calculator className="size-5" />,
          },
          {
            label: "نقدية فعلية",
            value: formatCurrency(t.actualCash, currency),
            icon: <Banknote className="size-5" />,
          },
          {
            label: "إجمالي الفرق",
            value: formatCurrency(t.variance, currency),
            icon: <AlertTriangle className="size-5" />,
          },
        ]}
      />

      <OperationalCard title="تسوية النقدية">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ["رصيد الافتتاح", t.openingCash],
              ["مبيعات نقدية", t.cashSales],
              ["مبيعات كارت", t.cardSales],
              ["مبيعات محفظة", t.walletSales],
              ["مبيعات آجلة", t.creditSales],
              ["مرتجعات نقدية", t.cashRefunds],
              ["مصروفات الدرج", t.expenses],
              ["النقدية المتوقعة", t.expectedCash],
              ["النقدية الفعلية", t.actualCash],
              ["الفرق", t.variance],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(value, currency)}
              </dd>
            </div>
          ))}
        </dl>
      </OperationalCard>

      {report.openCount > 0 ? (
        <OperationalCard title="جلسات ما زالت مفتوحة">
          <p className="mb-3 text-sm text-muted-foreground">
            {report.openCount} جلسة مفتوحة — لن تُحسب في إقفال اليوم حتى تُغلق.
          </p>
          <ul className="space-y-2 text-sm">
            {report.openSessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>
                  {s.cashierName} · {s.storeName}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  متوقع {formatCurrency(s.expectedCash, currency)}
                </span>
              </li>
            ))}
          </ul>
        </OperationalCard>
      ) : null}

      <ReportTable
        title="الجلسات المغلقة في الفترة"
        columns={columns}
        data={report.sessions}
        emptyMessage="لا توجد جلسات مغلقة في هذه الفترة"
      />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Landmark className="size-3.5" />
        الأرقام من نفس منطق إغلاق الجلسة (`report_session_reconciliation`).
      </p>
    </ReportPage>
  );
}
