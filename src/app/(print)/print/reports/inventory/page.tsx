import { getInventoryReportPageData } from "@/modules/reports/actions/inventory-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintInventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getInventoryReportPageData(params);

  return (
    <PrintableDocument
      branding={data.context}
      title="تقرير المخزون"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
    >
      <p className="mb-4 text-sm">
        التقييم: {formatCurrency(data.kpi.valuationEstimate, data.currency)} · مخزون منخفض:{" "}
        {data.kpi.lowStockCount} · قريب من الانتهاء: {data.nearExpiry.length}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">المنتج</th>
            <th className="py-2 text-end">الكمية</th>
            <th className="py-2 text-end">القيمة</th>
          </tr>
        </thead>
        <tbody>
          {data.valuation.slice(0, 100).map((row) => (
            <tr key={row.productId} className="border-b">
              <td className="py-2">{row.productName}</td>
              <td className="py-2 text-end">{row.quantity}</td>
              <td className="py-2 text-end">{formatCurrency(row.totalValue, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
