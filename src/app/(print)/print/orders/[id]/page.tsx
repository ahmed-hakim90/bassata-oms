import { notFound } from "next/navigation";
import { getOrder } from "@/modules/orders/services/order.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { requireAuth } from "@/lib/auth/guards";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default async function PrintOrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const order = await getOrder(id);
  if (!order) notFound();
  const branding = await getReportBranding(order.store_id);

  return (
    <PrintableDocument
      branding={branding}
      title="Sales Invoice"
      subtitle={order.order_number}
      dateRange={formatDateTime(order.created_at)}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
    >
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">Item</th>
            <th className="py-2 text-end">Qty</th>
            <th className="py-2 text-end">Price</th>
            <th className="py-2 text-end">Total</th>
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
        <p>Subtotal: {formatCurrency(order.subtotal, branding.currency)}</p>
        {order.discount > 0 ? (
          <p>Discount: -{formatCurrency(order.discount, branding.currency)}</p>
        ) : null}
        <p className="text-base font-bold">
          Total: {formatCurrency(order.total, branding.currency)}
        </p>
      </div>
    </PrintableDocument>
  );
}
