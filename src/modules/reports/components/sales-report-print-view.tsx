import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface SalesReportPrintData {
  summary?: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
  };
  context: ReportBranding & {
    filterSummary?: string;
    generatedBy: string;
    generatedAt: string;
  };
  currency: string;
}

export function SalesReportPrintView({ summary, context, currency }: SalesReportPrintData) {
  return (
    <PrintableDocument
      branding={context}
      title="تقرير المبيعات"
      dateRange={context.filterSummary}
      generatedBy={context.generatedBy}
      generatedAt={context.generatedAt}
      filterSummary={context.filterSummary}
    >
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 font-medium">الإيراد</td>
            <td className="py-1 text-end">
              {formatCurrency(summary?.totalRevenue ?? 0, currency)}
            </td>
          </tr>
          <tr>
            <td className="py-1 font-medium">الطلبات</td>
            <td className="py-1 text-end">{summary?.orderCount ?? 0}</td>
          </tr>
          <tr>
            <td className="py-1 font-medium">متوسط الطلب</td>
            <td className="py-1 text-end">
              {formatCurrency(summary?.avgOrderValue ?? 0, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </PrintableDocument>
  );
}
