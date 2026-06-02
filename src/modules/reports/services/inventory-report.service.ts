import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";

export interface InventoryKpi {
  totalSkus: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  valuationEstimate: number;
  movementSummary: { type: string; count: number; units: number }[];
  lowStockItems: { name: string; quantity: number; reorderPoint: number }[];
}

export async function getInventoryReport(storeId?: string): Promise<InventoryKpi> {
  const rawLevels = await inventoryRepo.listStockLevels(storeId);
  const levels = Array.from(
    rawLevels
      .reduce((map, level) => {
        const key = `${level.product_id}:${level.variant_id ?? ""}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...level });
        } else {
          existing.quantity += level.quantity;
          existing.reorder_point += level.reorder_point;
        }
        return map;
      }, new Map<string, (typeof rawLevels)[number]>())
      .values()
  );
  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalUnits = 0;
  let valuationEstimate = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockItems: InventoryKpi["lowStockItems"] = [];
  let totalSkus = 0;

  for (const level of levels) {
    const product = productMap.get(level.product_id);
    if (!product?.track_inventory) continue;
    totalSkus += 1;
    totalUnits += level.quantity;
    valuationEstimate += level.quantity * product.base_price;
    if (level.quantity <= 0) {
      outOfStockCount += 1;
      lowStockItems.push({
        name: product.name,
        quantity: level.quantity,
        reorderPoint: level.reorder_point,
      });
    } else if (level.quantity <= level.reorder_point) {
      lowStockCount += 1;
      lowStockItems.push({
        name: product.name,
        quantity: level.quantity,
        reorderPoint: level.reorder_point,
      });
    }
  }

  const movements = await inventoryRepo.listMovements(storeId);
  const summaryMap = new Map<string, { count: number; units: number }>();
  for (const m of movements) {
    const existing = summaryMap.get(m.movement_type) ?? { count: 0, units: 0 };
    existing.count += 1;
    existing.units += Math.abs(m.quantity_delta);
    summaryMap.set(m.movement_type, existing);
  }

  return {
    totalSkus,
    totalUnits,
    lowStockCount,
    outOfStockCount,
    valuationEstimate,
    movementSummary: [...summaryMap.entries()].map(([type, data]) => ({
      type,
      ...data,
    })),
    lowStockItems: lowStockItems.slice(0, 10),
  };
}
