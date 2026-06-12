import { getProfitReportPageData } from "@/modules/reports/actions/profit-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getProfitReportPageData(params);
  const rows = [
    ["Revenue", data.profit.revenue],
    ["COGS", data.profit.cogs],
    ["Gross profit", data.profit.grossProfit],
    ["Expenses", data.profit.totalExpenses],
    ["Waste cost", data.profit.wasteCost],
    ["Net profit", data.profit.estimatedNetProfit],
  ] as const;

  return (
    <PrintableDocument
      branding={data.context}
      title="Profit Report"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
    >
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <td className="py-2 font-medium">{label}</td>
              <td className="py-2 text-end">{formatCurrency(value, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
