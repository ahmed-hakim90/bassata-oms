import { getAgingReportPageData } from "@/modules/reports/actions/aging-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintAgingReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getAgingReportPageData(params);

  return (
    <PrintableDocument
      branding={data.context}
      title="أعمار الذمم"
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={data.context.filterSummary}
    >
      <h2 className="mb-2 text-base font-semibold">العملاء</h2>
      <p className="mb-3 text-sm">
        الإجمالي: {formatCurrency(data.report.customers.total, data.currency)}
      </p>
      <table className="mb-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">الاسم</th>
            <th className="py-2 text-end">الرصيد</th>
            <th className="py-2 text-end">أيام</th>
          </tr>
        </thead>
        <tbody>
          {data.report.customers.rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-end">
                {formatCurrency(row.balance, data.currency)}
              </td>
              <td className="py-2 text-end">{row.daysOutstanding}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">الموردين</h2>
      <p className="mb-3 text-sm">
        الإجمالي: {formatCurrency(data.report.suppliers.total, data.currency)}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">الاسم</th>
            <th className="py-2 text-end">الرصيد</th>
            <th className="py-2 text-end">أيام</th>
          </tr>
        </thead>
        <tbody>
          {data.report.suppliers.rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2">{row.name}</td>
              <td className="py-2 text-end">
                {formatCurrency(row.balance, data.currency)}
              </td>
              <td className="py-2 text-end">{row.daysOutstanding}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
