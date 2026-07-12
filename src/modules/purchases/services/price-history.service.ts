import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import type { Product, Supplier } from "@/lib/types";
import {
  enrichPurchases,
  type PurchaseWithLines,
} from "@/modules/purchases/services/purchase.service";

export interface SupplierPriceHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  unitCost: number;
  quantity: number;
  purchasedAt: string;
}

export interface SupplierPriceSummary {
  productId: string;
  productName: string;
  latestUnitCost: number;
  previousUnitCost: number | null;
  changePercent: number | null;
  supplierName: string;
  purchasedAt: string;
  history: SupplierPriceHistoryEntry[];
}

export function buildSupplierPriceHistory(
  purchases: PurchaseWithLines[],
  suppliers: Supplier[],
  products: Product[],
  limitPerProduct = 5
): SupplierPriceSummary[] {
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const productMap = new Map(products.map((product) => [product.id, product.name]));
  const byProduct = new Map<string, SupplierPriceHistoryEntry[]>();

  for (const purchase of purchases) {
    if (purchase.status !== "received") continue;
    const purchasedAt = purchase.received_at ?? purchase.created_at;
    for (const line of purchase.lines) {
      const entry: SupplierPriceHistoryEntry = {
        id: `${purchase.id}-${line.id}`,
        productId: line.product_id,
        productName: productMap.get(line.product_id) ?? "Unknown product",
        supplierId: purchase.supplier_id,
        supplierName: supplierMap.get(purchase.supplier_id) ?? purchase.supplierName,
        invoiceId: purchase.id,
        invoiceNumber: purchase.invoice_number,
        unitCost: line.unit_cost,
        quantity: line.quantity,
        purchasedAt,
      };
      const list = byProduct.get(line.product_id) ?? [];
      list.push(entry);
      byProduct.set(line.product_id, list);
    }
  }

  return [...byProduct.entries()]
    .map(([productId, history]) => {
      const sorted = history.sort(
        (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      );
      const latest = sorted[0]!;
      const previous = sorted.find((entry) => entry.unitCost !== latest.unitCost) ?? sorted[1] ?? null;
      const changePercent =
        previous && previous.unitCost > 0
          ? ((latest.unitCost - previous.unitCost) / previous.unitCost) * 100
          : null;

      return {
        productId,
        productName: latest.productName,
        latestUnitCost: latest.unitCost,
        previousUnitCost: previous?.unitCost ?? null,
        changePercent,
        supplierName: latest.supplierName,
        purchasedAt: latest.purchasedAt,
        history: sorted.slice(0, limitPerProduct),
      };
    })
    .sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
}

export async function getSupplierPriceHistory(
  storeId: string,
  preloaded?: {
    purchases?: PurchaseWithLines[];
    suppliers?: Supplier[];
    products?: Product[];
  }
): Promise<SupplierPriceSummary[]> {
  const [purchases, suppliers, products] = await Promise.all([
    preloaded?.purchases
      ? Promise.resolve(preloaded.purchases)
      : purchaseRepo.listPurchases(storeId).then((invoices) => enrichPurchases(invoices)),
    preloaded?.suppliers
      ? Promise.resolve(preloaded.suppliers)
      : purchaseRepo.listSuppliers(),
    preloaded?.products
      ? Promise.resolve(preloaded.products)
      : catalogRepo.listProducts(),
  ]);
  return buildSupplierPriceHistory(purchases, suppliers, products);
}
