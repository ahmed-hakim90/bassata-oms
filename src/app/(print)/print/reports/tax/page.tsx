import { getTaxReportPageData } from "@/modules/reports/actions/tax-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintTaxReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getTaxReportPageData(params);
  const s = data.report.summary;

  return (
    <PrintableDocument
      branding={data.context}
      title="تقرير الضريبة"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={data.context.filterSummary}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium">الأساس الخاضع</td>
            <td className="py-2 text-end tabular-nums">
              {formatCurrency(s.taxableBase, data.currency)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">الضريبة المحصّلة</td>
            <td className="py-2 text-end tabular-nums">
              {formatCurrency(s.taxCollected, data.currency)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">إجمالي المبيعات</td>
            <td className="py-2 text-end tabular-nums">
              {formatCurrency(s.grossSales, data.currency)}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">اليوم</th>
            <th className="py-2 text-end">طلبات</th>
            <th className="py-2 text-end">ضريبة</th>
            <th className="py-2 text-end">إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {data.report.byDay.map((row) => (
            <tr key={row.date} className="border-b">
              <td className="py-2">{row.date}</td>
              <td className="py-2 text-end">{row.orderCount}</td>
              <td className="py-2 text-end">
                {formatCurrency(row.tax, data.currency)}
              </td>
              <td className="py-2 text-end">
                {formatCurrency(row.total, data.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
