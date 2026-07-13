import { getDailyCloseReportPageData } from "@/modules/reports/actions/daily-close-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintDailyCloseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDailyCloseReportPageData(params);
  const t = data.report.totals;
  const rows = [
    ["رصيد الافتتاح", t.openingCash],
    ["مبيعات نقدية", t.cashSales],
    ["مبيعات كارت", t.cardSales],
    ["مبيعات محفظة", t.walletSales],
    ["مبيعات آجلة", t.creditSales],
    ["مرتجعات نقدية", t.cashRefunds],
    ["المصروفات", t.expenses],
    ["النقدية المتوقعة", t.expectedCash],
    ["النقدية الفعلية", t.actualCash],
    ["الفرق", t.variance],
  ] as const;

  return (
    <PrintableDocument
      branding={data.context}
      title="إقفال اليوم"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={data.context.filterSummary}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <td className="py-2 font-medium">{label}</td>
              <td className="py-2 text-end tabular-nums">
                {formatCurrency(value, data.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">الكاشير</th>
            <th className="py-2 text-start">الفرع</th>
            <th className="py-2 text-end">المتوقع</th>
            <th className="py-2 text-end">الفعلي</th>
            <th className="py-2 text-end">الفرق</th>
          </tr>
        </thead>
        <tbody>
          {data.report.sessions.map((session) => (
            <tr key={session.id} className="border-b">
              <td className="py-2">{session.cashierName}</td>
              <td className="py-2">{session.storeName}</td>
              <td className="py-2 text-end">
                {formatCurrency(session.expectedCash, data.currency)}
              </td>
              <td className="py-2 text-end">
                {session.actualCash != null
                  ? formatCurrency(session.actualCash, data.currency)
                  : "—"}
              </td>
              <td className="py-2 text-end">
                {session.variance != null
                  ? formatCurrency(session.variance, data.currency)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
