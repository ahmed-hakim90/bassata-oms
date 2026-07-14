import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface OrderInvoicePrintData {
  order: {
    order_number: string;
    created_at: string;
    customerName?: string | null;
    customerPhone?: string | null;
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }>;
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
  };
  branding: ReportBranding;
  userName: string;
}

export function OrderInvoicePrintView({ order, branding, userName }: OrderInvoicePrintData) {
  return (
    <PrintableDocument
      branding={branding}
      title="فاتورة مبيعات"
      subtitle={order.order_number}
      dateRange={formatDateTime(order.created_at)}
      generatedBy={userName}
      generatedAt={new Date().toISOString()}
    >
      {order.customerName || order.customerPhone ? (
        <p className="mb-4 text-sm">
          {order.customerName ? <>العميل: {order.customerName}</> : null}
          {order.customerName && order.customerPhone ? " · " : null}
          {order.customerPhone ? <span dir="ltr">{order.customerPhone}</span> : null}
        </p>
      ) : null}

      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">الصنف</th>
            <th className="py-2 text-end">الكمية</th>
            <th className="py-2 text-end">السعر</th>
            <th className="py-2 text-end">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">{item.productName}</td>
              <td className="py-2 text-end">{item.quantity}</td>
              <td className="py-2 text-end">
                {formatCurrency(item.unit_price, branding.currency)}
              </td>
              <td className="py-2 text-end">
                {formatCurrency(item.line_total, branding.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-end text-sm">
        <p>الإجمالي الفرعي: {formatCurrency(order.subtotal, branding.currency)}</p>
        {order.discount > 0 ? (
          <p>الخصم: -{formatCurrency(order.discount, branding.currency)}</p>
        ) : null}
        {(order.tax ?? 0) > 0 ? (
          <p>الضريبة: {formatCurrency(order.tax ?? 0, branding.currency)}</p>
        ) : null}
        <p className="text-base font-bold">
          الإجمالي: {formatCurrency(order.total, branding.currency)}
        </p>
      </div>
    </PrintableDocument>
  );
}
