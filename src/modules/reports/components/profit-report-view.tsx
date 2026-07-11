"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CircleDollarSign, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { exportProfitReportExcel } from "@/modules/reports/actions/profit-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { reportFiltersToSearchParams, type ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";

interface ProfitReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  profit: Awaited<ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProfitReport>>;
  rankings: Awaited<ReturnType<typeof import("@/modules/reports/services/profit-report.service").getProductRankings>>;
  outstanding: { id: string; name: string; account_balance: number }[];
  supplierBalances: { id: string; name: string; balanceDue: number }[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function ProfitReportView({
  filters,
  stores,
  currency,
  profit,
  rankings,
  outstanding,
  supplierBalances,
  canPrint,
  canExcel,
  canPdf,
}: ProfitReportViewProps) {
  const [pending, startTransition] = useTransition();
  const printQs = reportFiltersToSearchParams(filters);
  const printHref = `/print/reports/profit${printQs ? `?${printQs}` : ""}`;

  return (
    <ReportPage
      title="تقرير الأرباح"
      description="الإيراد وتكلفة البضاعة والمصروفات وصافي الربح"
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
                const result = await exportProfitReportExcel(
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
      filters={<ReportFiltersBar basePath="/reports/profit" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={4}
        items={[
          { label: "الإيراد", value: formatCurrency(profit.revenue, currency), icon: <TrendingUp className="size-5" /> },
          { label: "تكلفة البضاعة", value: formatCurrency(profit.cogs, currency), icon: <TrendingDown className="size-5" /> },
          { label: "إجمالي الربح", value: formatCurrency(profit.grossProfit, currency), icon: <CircleDollarSign className="size-5" /> },
          { label: "صافي الربح", value: formatCurrency(profit.estimatedNetProfit, currency), icon: <CircleDollarSign className="size-5" /> },
          { label: "المصروفات", value: formatCurrency(profit.totalExpenses, currency) },
          { label: "تكلفة الهالك", value: formatCurrency(profit.wasteCost, currency), icon: <Trash2 className="size-5" /> },
        ]}
      />
      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-2">
        <OperationalCard title="أفضل المنتجات حسب الربح">
          <ul className="space-y-2 text-sm">
            {rankings.highestProfit.map((p) => (
              <li key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <span className="tabular-nums">{formatCurrency(p.profit, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
        <OperationalCard title="أرصدة العملاء الآجلة">
          <ul className="space-y-2 text-sm">
            {outstanding.slice(0, 8).map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums">{formatCurrency(c.account_balance, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
        <OperationalCard title="أرصدة الموردين">
          <ul className="space-y-2 text-sm">
            {supplierBalances.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="tabular-nums">{formatCurrency(s.balanceDue, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
        <OperationalCard title="المصروفات حسب مركز التكلفة">
          <ul className="space-y-2 text-sm">
            {profit.expensesByCostCenter.slice(0, 8).map((c) => (
              <li key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="tabular-nums">{formatCurrency(c.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </OperationalCard>
      </div>
    </ReportPage>
  );
}
