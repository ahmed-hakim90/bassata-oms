import { getSessionClosingData } from "@/modules/reports/actions/session-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default async function PrintSessionClosingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSessionClosingData(id);
  const rows = [
    ["رصيد الافتتاح", data.reconciliation.openingCash],
    ["مبيعات نقدية", data.reconciliation.cashSales],
    ["مبيعات كارت", data.reconciliation.cardSales],
    ["مبيعات محفظة", data.reconciliation.walletSales],
    ["مبيعات آجلة", data.reconciliation.creditSales],
    ["مرتجعات نقدية", data.reconciliation.cashRefunds],
    ["المصروفات", data.reconciliation.expenses],
    ["النقدية المتوقعة", data.reconciliation.expectedCash],
    ["النقدية الفعلية", data.actualCash ?? 0],
    ["الفرق", data.variance ?? 0],
  ] as const;

  return (
    <PrintableDocument
      branding={{
        orgName: data.org.name,
        orgLogoUrl: data.org.logo_url ?? null,
        currency: data.currency,
        storeName: data.storeName,
        storeAddress: null,
        storePhone: null,
        receiptHeader: null,
        receiptFooter: null,
      }}
      title="تقرير إغلاق الجلسة"
      subtitle={`${data.cashierName} · ${formatDateTime(data.session.opened_at)}`}
      generatedBy={data.generatedBy}
      generatedAt={data.generatedAt}
    >
      <table className="w-full text-sm">
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
    </PrintableDocument>
  );
}
