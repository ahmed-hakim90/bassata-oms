import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getOrder } from "@/modules/orders/services/order.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { OrderInvoicePrintView } from "@/modules/orders/components/order-invoice-print-view";

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

  return <OrderInvoicePrintView order={order} branding={branding} userName={user.name} />;
}
