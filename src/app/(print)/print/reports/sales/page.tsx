import { getSalesReportPageData } from "@/modules/reports/actions/sales-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getSalesReportPageData(params);
  return (
    <PrintableDocument
      branding={data.context}
      title="Sales Report"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={data.context.filterSummary}
    >
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 font-medium">Revenue</td>
            <td className="py-1 text-end">
              {formatCurrency(data.summary?.totalRevenue ?? 0, data.currency)}
            </td>
          </tr>
          <tr>
            <td className="py-1 font-medium">Orders</td>
            <td className="py-1 text-end">{data.summary?.orderCount ?? 0}</td>
          </tr>
          <tr>
            <td className="py-1 font-medium">Average order</td>
            <td className="py-1 text-end">
              {formatCurrency(data.summary?.avgOrderValue ?? 0, data.currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </PrintableDocument>
  );
}
