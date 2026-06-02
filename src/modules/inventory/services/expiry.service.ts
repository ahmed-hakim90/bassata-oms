import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import type { InventoryBatch, MeasurementUnit, Product } from "@/lib/types";

export interface ExpiryBatchAlert {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  remainingQuantity: number;
  unit: MeasurementUnit;
  daysUntilExpiry: number;
  severity: "danger" | "warning";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function summarizeExpiryBatches(
  batches: InventoryBatch[],
  products: Product[],
  options: { today?: Date; warningDays?: number } = {}
): ExpiryBatchAlert[] {
  const today = options.today ?? startOfToday();
  const warningDays = options.warningDays ?? 14;
  const productMap = new Map(products.map((product) => [product.id, product]));

  return batches
    .filter((batch) => batch.expiry_date && batch.remaining_quantity > 0)
    .map((batch) => {
      const expiry = new Date(batch.expiry_date!);
      const daysUntilExpiry = Math.ceil(
        (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry > warningDays) return null;
      return {
        id: batch.id,
        productId: batch.product_id,
        productName: productMap.get(batch.product_id)?.name ?? "Unknown product",
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date!,
        remainingQuantity: batch.remaining_quantity,
        unit: batch.unit,
        daysUntilExpiry,
        severity: daysUntilExpiry < 0 ? "danger" : "warning",
      } satisfies ExpiryBatchAlert;
    })
    .filter((alert): alert is ExpiryBatchAlert => Boolean(alert))
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
}

export async function getExpiryBatchAlerts(
  storeId: string,
  warehouseId?: string,
  warningDays = 14
): Promise<ExpiryBatchAlert[]> {
  const [batches, products] = await Promise.all([
    inventoryRepo.listInventoryBatches(storeId, warehouseId),
    catalogRepo.listProducts(),
  ]);
  return summarizeExpiryBatches(batches, products, { warningDays });
}
