import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getOrder } from "@/modules/orders/services/order.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default async function PrintOrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requirePageAuth(`/print/orders/${id}`);
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }
  const user = auth.data;
  const order = await getOrder(id);
  if (!order) notFound();
  const branding = await getReportBranding(order.store_id);

  return (
    <PrintableDocument
      branding={branding}
      title="فاتورة مبيعات"
      subtitle={order.order_number}
      dateRange={formatDateTime(order.created_at)}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
    >
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
        <p className="text-base font-bold">
          الإجمالي: {formatCurrency(order.total, branding.currency)}
        </p>
      </div>
    </PrintableDocument>
  );
}
