import { notFound } from "next/navigation";
import { getOrder } from "@/modules/orders/services/order.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { ReceiptPrintServer } from "@/modules/pos/components/receipt-print-server";

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const branding = await getReportBranding(order.store_id);

  const subtotal = order.items.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <ReceiptPrintServer
      documentLabel="ريسيت مبيعات"
      orderNumber={order.order_number}
      createdAt={order.created_at}
      items={order.items}
      subtotal={subtotal}
      discount={order.discount}
      promoDiscount={order.promo_discount ?? undefined}
      tax={order.tax}
      total={order.total}
      paymentStatus={order.payment_status}
      payments={order.payments}
      partyLabel="العميل"
      partyName={order.customerName}
      isDraft={order.document_status === "draft"}
      branding={branding}
    />
  );
}
