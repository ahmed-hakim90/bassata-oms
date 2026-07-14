import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageAuth } from "@/lib/auth/page-guard";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getPurchase } from "@/modules/purchases/services/purchase.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { ReceiptPrintServer } from "@/modules/pos/components/receipt-print-server";

export default async function PrintPurchaseReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requirePageAuth(`/print/purchases/${id}/receipt`);
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  const purchase = await getPurchase(id);
  if (!purchase) notFound();

  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const branding = await getReportBranding(purchase.store_id);

  const items = purchase.lines.map((line) => ({
    id: line.id,
    productName: productMap.get(line.product_id) ?? line.product_id,
    quantity: line.quantity,
    unit_price: line.landed_unit_cost ?? line.unit_cost,
    line_total: line.landed_line_total ?? line.line_total,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  return (
    <ReceiptPrintServer
      documentLabel="ريسيت مشتريات"
      orderNumber={purchase.invoice_number}
      createdAt={purchase.created_at}
      items={items}
      subtotal={subtotal}
      discount={0}
      tax={purchase.tax ?? 0}
      total={purchase.total}
      partyLabel="المورد"
      partyName={purchase.supplierName}
      metaLines={purchase.warehouseName ? [`المخزن: ${purchase.warehouseName}`] : undefined}
      isDraft={purchase.status === "draft"}
      branding={branding}
    />
  );
}
