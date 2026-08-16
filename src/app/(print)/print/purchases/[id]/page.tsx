import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getPurchase } from "@/modules/purchases/services/purchase.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getCommercialPrintContext } from "@/modules/print-engine/services/print-engine.service";
import { CommercialDocumentView } from "@/modules/print-engine/components/commercial-document-view";
import { mapPurchaseToCommercialDocument } from "@/modules/print-engine/lib/map-commercial-document";
import { commercialDocumentQrDataUrl } from "@/modules/print-engine/lib/document-qr";
import { resolvePrintTemplate } from "@/modules/print-engine/lib/print-engine-settings";

export default async function PrintPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requirePageAuth(`/print/purchases/${id}`);
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }
  const user = auth.data;
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const products = await catalogRepo.listProducts();
  const productMap = new Map(
    products.map((product) => [
      product.id,
      { name: product.name, sku: product.sku, unit: product.unit },
    ])
  );
  const { branding, settings } = await getCommercialPrintContext(purchase.store_id);
  const document = mapPurchaseToCommercialDocument({ purchase, productMap });
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
