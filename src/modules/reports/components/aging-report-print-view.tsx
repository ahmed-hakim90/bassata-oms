import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface AgingReportPrintData {
  report: {
    customers: {
      total: number;
      rows: Array<{
        id: string;
        name: string;
        balance: number;
        daysOutstanding: number;
      }>;
    };
    suppliers: {
      total: number;
      rows: Array<{
        id: string;
        name: string;
        balance: number;
        daysOutstanding: number;
      }>;
    };
  };
  context: ReportBranding & {
    filterSummary?: string;
    generatedBy: string;
    generatedAt: string;
  };
  currency: string;
}

export function AgingReportPrintView({
  report,
  context,
  currency,
  side = "all",
  creditSalesEnabled = true,
}: AgingReportPrintData & {
  side?: "all" | "customers" | "suppliers";
  creditSalesEnabled?: boolean;
}) {
  const showCustomers =
    creditSalesEnabled && (side === "all" || side === "customers");
  const showSuppliers = side === "all" || side === "suppliers";
  const title =
    side === "customers"
      ? "مديونية العملاء"
      : side === "suppliers"
        ? "مديونية الموردين"
        : "مديونية العملاء والموردين";

  return (
    <PrintableDocument
      branding={context}
      title={title}
      generatedBy={context.generatedBy}
      generatedAt={context.generatedAt}
      filterSummary={context.filterSummary}
    >
      {showCustomers ? (
        <>
          <h2 className="mb-2 text-base font-semibold">العملاء</h2>
          <p className="mb-3 text-sm">
            الإجمالي: {formatCurrency(report.customers.total, currency)}
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
              {report.customers.rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-end">
                    {formatCurrency(row.balance, currency)}
                  </td>
                  <td className="py-2 text-end">{row.daysOutstanding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {showSuppliers ? (
        <>
          <h2 className="mb-2 text-base font-semibold">الموردين</h2>
          <p className="mb-3 text-sm">
            الإجمالي: {formatCurrency(report.suppliers.total, currency)}
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
              {report.suppliers.rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-end">
                    {formatCurrency(row.balance, currency)}
                  </td>
                  <td className="py-2 text-end">{row.daysOutstanding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </PrintableDocument>
  );
}
