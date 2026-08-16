import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getOrder } from "@/modules/orders/services/order.service";
import { getCommercialPrintContext } from "@/modules/print-engine/services/print-engine.service";
import { CommercialDocumentView } from "@/modules/print-engine/components/commercial-document-view";
import { mapOrderToCommercialDocument } from "@/modules/print-engine/lib/map-commercial-document";
import { commercialDocumentQrDataUrl } from "@/modules/print-engine/lib/document-qr";
import { resolvePrintTemplate } from "@/modules/print-engine/lib/print-engine-settings";

export default async function PrintOrderInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string; embed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const auth = await requirePageAuth(`/print/orders/${id}`);
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }
  const user = auth.data;
  const order = await getOrder(id);
  if (!order) notFound();
  const { branding, settings } = await getCommercialPrintContext(order.store_id);
  const document = mapOrderToCommercialDocument(
    order,
    query.variant === "delivery" ? { kind: "delivery_note" } : undefined
  );
  const template = resolvePrintTemplate(settings, document.kind);
  const qrDataUrl = template.fields.showQr
    ? await commercialDocumentQrDataUrl(document.number)
    : null;

  return (
    <CommercialDocumentView
      branding={branding}
      settings={template}
      document={document}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
      qrDataUrl={qrDataUrl}
    />
  );
}
