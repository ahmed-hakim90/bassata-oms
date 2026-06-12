import { getSessionsReportPageData } from "@/modules/reports/actions/session-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";

export default async function PrintSessionsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getSessionsReportPageData(params);
  return (
    <PrintableDocument
      branding={data.context}
      title="Sessions Report"
      dateRange={data.context.filterSummary}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={data.context.filterSummary}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">Cashier</th>
            <th className="py-2 text-start">Store</th>
            <th className="py-2 text-end">Variance</th>
            <th className="py-2 text-start">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.kpi.recentSessions.map((session) => (
            <tr key={session.id} className="border-b">
              <td className="py-2">{session.cashierName}</td>
              <td className="py-2">{session.storeName}</td>
              <td className="py-2 text-end">
                {session.variance != null
                  ? formatCurrency(session.variance, data.currency)
                  : "—"}
              </td>
              <td className="py-2">{session.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
