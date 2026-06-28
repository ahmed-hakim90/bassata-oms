import { getExpensesReportPageData } from "@/modules/reports/actions/expenses-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintExpensesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getExpensesReportPageData(params);

  return (
    <PrintableDocument
      branding={data.context}
      title="تقرير المصروفات"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
    >
      <p className="mb-4 text-lg font-semibold">
        الإجمالي: {formatCurrency(data.total, data.currency)}
      </p>
      <h3 className="mb-2 font-medium">حسب مركز التكلفة</h3>
      <table className="mb-6 w-full text-sm">
        <tbody>
          {data.byCenter.map((row) => (
            <tr key={row.name} className="border-b">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-end">{formatCurrency(row.amount, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mb-2 font-medium">حسب التصنيف</h3>
      <table className="w-full text-sm">
        <tbody>
          {data.byCategory.map((row) => (
            <tr key={row.name} className="border-b">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-end">{formatCurrency(row.amount, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
