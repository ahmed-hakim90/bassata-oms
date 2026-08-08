"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { OperationalCard } from "@/components/Velora/operational-card";
import { exportPnlReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { PnlLine } from "@/modules/reports/services/executive-analytics.service";
import type { ProfitReportDetail } from "@/modules/reports/services/profit-report.service";

interface PnlReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  lines: PnlLine[];
  estimatedNet: number;
  profit: ProfitReportDetail;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function PnlReportView({
  filters,
  stores,
  currency,
  lines,
  estimatedNet,
  profit,
  canExcel,
}: PnlReportViewProps) {
  const [pending, startTransition] = useTransition();

  return (
    <ReportPage
      title="قائمة الدخل المبسّطة"
      description="إيراد، تكلفة، ربح إجمالي، مصروفات، هالك، مرتجعات، وصافي تقديري"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportPnlReportExcel(
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
      filters={<ReportFiltersBar basePath="/reports/pnl" filters={filters} options={{ stores }} />}
    >
      <ReportKpiGrid
        columns={3}
        items={[
          {
            label: "الإيراد",
            value: formatCurrency(profit.revenue, currency),
            icon: <ShoppingBag className="size-5" />,
          },
          {
            label: "إجمالي الربح",
            value: formatCurrency(profit.grossProfit, currency),
            icon: <CircleDollarSign className="size-5" />,
          },
          {
            label: "صافي تقديري",
            value: formatCurrency(estimatedNet, currency),
            icon: <Wallet className="size-5" />,
          },
        ]}
      />

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-3">
        <OperationalCard title="مصروفات" className="lg:col-span-1">
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.totalExpenses, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="size-3.5" /> من تقرير الأرباح
          </p>
        </OperationalCard>
        <OperationalCard title="الهالك">
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.wasteCost, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Trash2 className="size-3.5" /> تكلفة تقديرية
          </p>
        </OperationalCard>
        <OperationalCard title="المرتجعات">
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(profit.refunds, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Undo2 className="size-3.5" /> ملغى / مسترد
          </p>
        </OperationalCard>
      </div>

      <OperationalCard title="قائمة الدخل">
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li
              key={line.key}
              className={cn(
                "flex items-center justify-between gap-4 py-3 text-sm",
                line.emphasis === "subtotal" && "font-medium bg-muted/40 px-2 rounded-md",
                line.emphasis === "total" && "font-semibold text-base pt-4"
              )}
            >
              <span>{line.labelAr}</span>
              <span
                className={cn(
                  "tabular-nums",
                  line.amount < 0 && "text-destructive"
                )}
              >
                {formatCurrency(line.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      </OperationalCard>
    </ReportPage>
  );
}
