import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface DailyCloseReportPrintData {
  report: {
    totals: {
      openingCash: number;
      cashSales: number;
      cardSales: number;
      walletSales: number;
      creditSales: number;
      cashRefunds: number;
      expenses: number;
      expectedCash: number;
      actualCash: number;
      variance: number;
    };
    sessions: Array<{
      id: string;
      cashierName: string;
      storeName: string;
      expectedCash: number;
      actualCash: number | null;
      variance: number | null;
    }>;
  };
  context: ReportBranding & {
    filterSummary?: string;
    generatedBy: string;
    generatedAt: string;
  };
  currency: string;
}

export function DailyClosePrintView({ report, context, currency }: DailyCloseReportPrintData) {
  const t = report.totals;
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
      branding={context}
      title="إقفال اليوم"
      dateRange={context.filterSummary}
      generatedBy={context.generatedBy}
      generatedAt={context.generatedAt}
      filterSummary={context.filterSummary}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <td className="py-2 font-medium">{label}</td>
              <td className="py-2 text-end tabular-nums">
                {formatCurrency(value, currency)}
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
          {report.sessions.map((session) => (
            <tr key={session.id} className="border-b">
              <td className="py-2">{session.cashierName}</td>
              <td className="py-2">{session.storeName}</td>
              <td className="py-2 text-end">
                {formatCurrency(session.expectedCash, currency)}
              </td>
              <td className="py-2 text-end">
                {session.actualCash != null
                  ? formatCurrency(session.actualCash, currency)
                  : "—"}
              </td>
              <td className="py-2 text-end">
                {session.variance != null
                  ? formatCurrency(session.variance, currency)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}
