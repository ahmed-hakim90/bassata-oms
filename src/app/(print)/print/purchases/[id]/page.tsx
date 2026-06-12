import { notFound } from "next/navigation";
import { getPurchase } from "@/modules/purchases/services/purchase.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { requireAuth } from "@/lib/auth/guards";
import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default async function PrintPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const branding = await getReportBranding(purchase.store_id);

  return (
    <PrintableDocument
      branding={branding}
      title="Purchase Invoice"
      subtitle={purchase.invoice_number}
      dateRange={formatDateTime(purchase.created_at)}
      generatedBy={user.name}
      generatedAt={new Date().toISOString()}
    >
      <p className="mb-4 text-sm">
        Supplier: {purchase.supplierName} · Warehouse: {purchase.warehouseName}
      </p>
      <table className="mb-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">Product</th>
            <th className="py-2 text-end">Qty</th>
            <th className="py-2 text-end">Cost</th>
            <th className="py-2 text-end">Total</th>
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
        Total: {formatCurrency(purchase.total, branding.currency)}
      </p>
    </PrintableDocument>
  );
}
