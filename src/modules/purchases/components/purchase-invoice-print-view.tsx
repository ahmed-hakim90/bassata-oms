import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface PurchaseInvoicePrintData {
  purchase: {
    invoice_number: string;
    created_at: string;
    supplierName: string;
    warehouseName: string;
    lines: Array<{
      id: string;
      product_id: string;
      quantity: number;
      unit_cost: number;
      line_total: number;
    }>;
    total: number;
  };
  productMap: Map<string, string>;
  branding: ReportBranding;
  userName: string;
}

export function PurchaseInvoicePrintView({
  purchase,
  productMap,
  branding,
  userName,
}: PurchaseInvoicePrintData) {
  return (
    <PrintableDocument
      branding={branding}
      title="فاتورة شراء"
      subtitle={purchase.invoice_number}
      dateRange={formatDateTime(purchase.created_at)}
      generatedBy={userName}
      generatedAt={new Date().toISOString()}
    >
      <p className="mb-4 text-sm">
        المورد: {purchase.supplierName} · المخزن: {purchase.warehouseName}
      </p>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">المنتج</th>
            <th className="py-2 text-end">الكمية</th>
            <th className="py-2 text-end">التكلفة</th>
            <th className="py-2 text-end">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {purchase.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{productMap.get(line.product_id) ?? line.product_id}</td>
              <td className="py-2 text-end">{line.quantity}</td>
              <td className="py-2 text-end">
                {formatCurrency(line.unit_cost, branding.currency)}
              </td>
              <td className="py-2 text-end">
                {formatCurrency(line.line_total, branding.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-end text-base font-bold">
        الإجمالي: {formatCurrency(purchase.total, branding.currency)}
      </p>
    </PrintableDocument>
  );
}
