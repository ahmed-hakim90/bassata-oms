"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportAgingReportExcel } from "@/modules/reports/actions/aging-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  reportFiltersToSearchParams,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { AgingReport, AgingPartyRow } from "@/modules/reports/services/aging-report.service";
import type { Store } from "@/lib/types";

interface AgingReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: AgingReport;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function partyColumns(
  currency: string,
  kind: "customer" | "supplier"
): ColumnDef<AgingPartyRow>[] {
  return [
    {
      header: kind === "customer" ? "العميل" : "المورد",
      id: "name",
      cell: ({ row }) => (
        <Link
          href={
            kind === "customer"
              ? `/customers/${row.original.id}`
              : `/inventory/suppliers/${row.original.id}`
          }
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      header: "الرصيد",
      id: "balance",
      cell: ({ row }) => formatCurrency(row.original.balance, currency),
    },
    { header: "أيام", accessorKey: "daysOutstanding" },
    {
      header: "0–30",
      id: "b0",
      cell: ({ row }) => formatCurrency(row.original.buckets.current, currency),
    },
    {
      header: "31–60",
      id: "b30",
      cell: ({ row }) => formatCurrency(row.original.buckets.days30, currency),
    },
    {
      header: "61–90",
      id: "b60",
      cell: ({ row }) => formatCurrency(row.original.buckets.days60, currency),
    },
    {
      header: "90+",
      id: "b90",
      cell: ({ row }) =>
        formatCurrency(
          row.original.buckets.days90 + row.original.buckets.over90,
          currency
        ),
    },
  ];
}

export function AgingReportView({
  filters,
  stores,
  currency,
  report,
  canPrint,
  canExcel,
  canPdf,
}: AgingReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/aging${printQs ? `?${printQs}` : ""}`;

  return (
    <ReportPage
      title="أعمار الذمم"
      description="أرصدة العملاء (مدينون) والموردين (دائنون) حسب العمر"
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
                const result = await exportAgingReportExcel(
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
          basePath="/reports/aging"
          filters={filters}
          options={{ stores, showDateRange: false, showDaysPresets: false }}
        />
      }
    >
      <ReportKpiGrid
        items={[
          {
            label: "مستحقات العملاء",
            value: formatCurrency(report.customers.total, currency),
            icon: <Users className="size-5" />,
          },
          {
            label: "مستحقات الموردين",
            value: formatCurrency(report.suppliers.total, currency),
            icon: <Building2 className="size-5" />,
          },
          {
            label: "عملاء بمديونية",
            value: String(report.customers.rows.length),
            icon: <Users className="size-5" />,
          },
          {
            label: "موردين بمديونية",
            value: String(report.suppliers.rows.length),
            icon: <Building2 className="size-5" />,
          },
        ]}
      />

      <ReportTable
        title="عمر الذمم — العملاء"
        columns={partyColumns(currency, "customer")}
        data={report.customers.rows}
        emptyMessage="لا توجد أرصدة عملاء مستحقة"
      />

      <ReportTable
        title="عمر الذمم — الموردين"
        columns={partyColumns(currency, "supplier")}
        data={report.suppliers.rows}
        emptyMessage="لا توجد أرصدة موردين مستحقة"
      />
    </ReportPage>
  );
}
