"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportExpensesReportExcel } from "@/modules/reports/actions/expenses-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { reportFiltersToSearchParams, type ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";

interface ExpensesReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  total: number;
  byCenter: { name: string; amount: number }[];
  byCategory: { name: string; amount: number }[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function ExpensesReportView({
  filters,
  stores,
  currency,
  total,
  byCenter,
  byCategory,
  canPrint,
  canExcel,
  canPdf,
}: ExpensesReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/expenses${printQs ? `?${printQs}` : ""}`;

  return (
    <ReportPage
      title="Expenses Report"
      description="Cost center and category breakdown"
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
                const result = await exportExpensesReportExcel(
                  Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [k, v === undefined ? undefined : String(v)])
                  ) as Record<string, string>
                );
                downloadBase64Excel(result.base64, result.filename);
                toast.success("Excel exported");
              } catch {
                toast.error("Export failed");
              }
            });
          }}
        />
      }
      filters={<ReportFiltersBar basePath="/reports/expenses" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={2}
        items={[{ label: "Total expenses", value: formatCurrency(total, currency), icon: <Wallet className="size-5" /> }]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <OperationalCard title="By cost center">
          <ul className="space-y-2 text-sm">
            {byCenter.map((row) => (
              <li key={row.name} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatCurrency(row.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
        <OperationalCard title="By category">
          <ul className="space-y-2 text-sm">
            {byCategory.map((row) => (
              <li key={row.name} className="flex justify-between">
                <span>{row.name}</span>
                <span>{formatCurrency(row.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
      </div>
    </ReportPage>
  );
}
