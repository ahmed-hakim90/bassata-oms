import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import { getPurchase } from "@/modules/purchases/services/purchase.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { PurchaseInvoicePrintView } from "@/modules/purchases/components/purchase-invoice-print-view";

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
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const branding = await getReportBranding(purchase.store_id);

  return (
    <PurchaseInvoicePrintView
      purchase={purchase}
      productMap={productMap}
      branding={branding}
      userName={user.name}
    />
  );
}
