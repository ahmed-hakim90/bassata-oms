"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { AgingSide } from "@/modules/reports/lib/aging-side";
import type { Store } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgingReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  report: AgingReport;
  side: AgingSide;
  creditSalesEnabled: boolean;
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

function partyColumns(
  currency: string,
  kind: "customer" | "supplier"
): ColumnDef<AgingPartyRow>[] {
  const columns: ColumnDef<AgingPartyRow>[] = [
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
      header: "تليفون",
      id: "phone",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.phone?.trim() || "—"}
        </span>
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

  if (kind === "customer") {
    columns.push({
      header: "إجراء",
      id: "collect",
      cell: ({ row }) =>
        row.original.balance > 0 ? (
          <Link
            href={`/customers/${row.original.id}?collect=1`}
            className="text-sm font-medium text-[var(--mds-color-action-primary)] hover:underline"
          >
            تحصيل
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    });
  } else {
    columns.push({
      header: "إجراء",
      id: "pay",
      cell: ({ row }) =>
        row.original.balance > 0 ? (
          <Link
            href={`/inventory/suppliers/${row.original.id}?pay=1`}
            className="text-sm font-medium text-[var(--mds-color-action-primary)] hover:underline"
          >
            سداد
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    });
  }

  return columns;
}

export function AgingReportView({
  filters,
  stores,
  currency,
  report,
  side,
  creditSalesEnabled,
  canPrint,
  canExcel,
  canPdf,
}: AgingReportViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const showCustomers = creditSalesEnabled && (side === "all" || side === "customers");
  const showSuppliers = side === "all" || side === "suppliers";
  const customersOnlyRequested = side === "customers" && !creditSalesEnabled;

  const printQs = reportFiltersToSearchParams(filters);
  const sideQs = side !== "all" ? `side=${side}` : "";
  const printHref = `/print/reports/aging${
    [printQs, sideQs].filter(Boolean).join("&")
      ? `?${[printQs, sideQs].filter(Boolean).join("&")}`
      : ""
  }`;

  const setSide = (next: AgingSide) => {
    const qs = reportFiltersToSearchParams(filters);
    const parts = [qs, next !== "all" ? `side=${next}` : ""].filter(Boolean);
    router.push(parts.length ? `/reports/aging?${parts.join("&")}` : "/reports/aging");
  };

  const title =
    side === "customers"
      ? "مديونية العملاء"
      : side === "suppliers"
        ? "مديونية الموردين"
        : "مديونية العملاء والموردين";

  const description =
    side === "customers"
      ? "أرصدة العملاء المستحقة حسب عمر الدين"
      : side === "suppliers"
        ? "أرصدة الموردين المستحقة حسب عمر الدين"
        : "أرصدة العملاء (مدينون) والموردين (دائنون) حسب العمر";

  const kpiItems = [
    ...(showCustomers || customersOnlyRequested
      ? [
          {
            label: "مستحقات العملاء",
            value: formatCurrency(report.customers.total, currency),
            icon: <Users className="size-5" />,
          },
          {
            label: "عملاء بمديونية",
            value: String(report.customers.rows.length),
            icon: <Users className="size-5" />,
          },
        ]
      : []),
    ...(showSuppliers
      ? [
          {
            label: "مستحقات الموردين",
            value: formatCurrency(report.suppliers.total, currency),
            icon: <Building2 className="size-5" />,
          },
          {
            label: "موردين بمديونية",
            value: String(report.suppliers.rows.length),
            icon: <Building2 className="size-5" />,
          },
        ]
      : []),
  ];

  return (
    <ReportPage
      title={title}
      description={description}
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
                const result = await exportAgingReportExcel({
                  ...Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [
                      k,
                      v === undefined ? undefined : String(v),
                    ])
                  ),
                  side: side === "all" ? undefined : side,
                } as Record<string, string>);
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
        <div className="flex flex-col gap-[var(--mds-space-3)]">
          <div className="flex flex-wrap gap-[var(--mds-space-2)]">
            {(
              [
                { value: "all" as const, label: "الكل", show: true },
                {
                  value: "customers" as const,
                  label: "العملاء",
                  show: creditSalesEnabled,
                },
                { value: "suppliers" as const, label: "الموردين", show: true },
              ] as const
            )
              .filter((tab) => tab.show)
              .map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  size="sm"
                  variant={side === tab.value ? "default" : "outline"}
                  className={cn("min-h-10 rounded-[var(--mds-radius-md)]")}
                  onClick={() => setSide(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
          </div>
          <ReportFiltersBar
            basePath="/reports/aging"
            filters={{
              ...filters,
              ...(side !== "all" ? { side } : {}),
            } as ReportFilters}
            options={{ stores, showDateRange: false, showDaysPresets: false }}
          />
        </div>
      }
    >
      <ReportKpiGrid items={kpiItems} />

      {customersOnlyRequested ? (
        <p className="rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          مديونية العملاء متاحة لما يكون البيع الآجل مفعّل من الخصائص.
        </p>
      ) : null}

      {showCustomers ? (
        <ReportTable
          title="مديونية العملاء"
          columns={partyColumns(currency, "customer")}
          data={report.customers.rows}
          emptyMessage="لا توجد أرصدة عملاء مستحقة"
        />
      ) : null}

      {showSuppliers ? (
        <ReportTable
          title="مديونية الموردين"
          columns={partyColumns(currency, "supplier")}
          data={report.suppliers.rows}
          emptyMessage="لا توجد أرصدة موردين مستحقة"
        />
      ) : null}
    </ReportPage>
  );
}
