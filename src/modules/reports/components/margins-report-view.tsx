"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ReportPage } from "@/modules/reports/components/report-page";
import { ReportFiltersBar } from "@/modules/reports/components/report-filters";
import { ReportKpiGrid } from "@/modules/reports/components/report-kpi-grid";
import { ReportTable } from "@/modules/reports/components/report-table";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportMarginsReportExcel } from "@/modules/reports/actions/executive-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { ReportFilters } from "@/modules/reports/core/report-filters.schema";
import type { ReportContext } from "@/modules/reports/core/report-context";
import type { Store } from "@/lib/types";
import type { ProductProfitRow } from "@/modules/reports/services/profit-report.service";
import type { CategoryMarginRow } from "@/modules/reports/services/executive-analytics.service";

interface MarginsReportViewProps {
  filters: ReportFilters;
  stores: Store[];
  currency: string;
  context: ReportContext;
  products: ProductProfitRow[];
  categories: CategoryMarginRow[];
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
}

export function MarginsReportView({
  filters,
  stores,
  currency,
  products,
  categories,
  canExcel,
}: MarginsReportViewProps) {
  const [pending, startTransition] = useTransition();
  const topProduct = products[0];
  const topCategory = categories[0];

  const productColumns: ColumnDef<ProductProfitRow>[] = [
    { header: "الصنف", accessorKey: "name" },
    {
      id: "qty",
      header: "الكمية",
      cell: ({ row }) => row.original.quantitySold.toLocaleString("ar-EG"),
    },
    {
      id: "revenue",
      header: "المبيعات",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "cost",
      header: "التكلفة",
      cell: ({ row }) => formatCurrency(row.original.cost, currency),
    },
    {
      id: "profit",
      header: "الربح",
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: "الهامش %",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  const categoryColumns: ColumnDef<CategoryMarginRow>[] = [
    { header: "التصنيف", accessorKey: "categoryName" },
    {
      id: "qty",
      header: "الكمية",
      cell: ({ row }) => row.original.quantitySold.toLocaleString("ar-EG"),
    },
    {
      id: "revenue",
      header: "المبيعات",
      cell: ({ row }) => formatCurrency(row.original.revenue, currency),
    },
    {
      id: "profit",
      header: "الربح",
      cell: ({ row }) => formatCurrency(row.original.profit, currency),
    },
    {
      id: "margin",
      header: "الهامش %",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  return (
    <ReportPage
      title="ترتيب الهوامش"
      description="أعلى هامش إجمالي للأصناف والتصنيفات (من تكلفة البنود)"
      actions={
        <ExportButtonGroup
          canPrint={false}
          canExcel={canExcel}
          canPdf={false}
          pending={pending}
          onExportExcel={() => {
            startTransition(async () => {
              try {
                const result = await exportMarginsReportExcel(
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
        <ReportFiltersBar basePath="/reports/margins" filters={filters} options={{ stores }} />
      }
    >
      <ReportKpiGrid
        columns={2}
        items={[
          {
            label: "أعلى هامش صنف",
            value: topProduct
              ? `${topProduct.name} (${topProduct.margin.toFixed(1)}%)`
              : "—",
            icon: <Percent className="size-5" />,
          },
          {
            label: "أعلى هامش تصنيف",
            value: topCategory
              ? `${topCategory.categoryName} (${topCategory.margin.toFixed(1)}%)`
              : "—",
            icon: <Layers className="size-5" />,
          },
        ]}
      />

      <ReportTable title="الأصناف حسب الهامش" columns={productColumns} data={products} />
      <ReportTable title="التصنيفات حسب الهامش" columns={categoryColumns} data={categories} />
    </ReportPage>
  );
}
