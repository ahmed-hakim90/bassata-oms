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
  expiredItems: number;
  expiringIn7Days: number;
  expiringIn14Days: number;
  expiringIn30Days: number;
  expiryLossValue: number;
  expiryWastePercent: number;
  topExpiredProducts: { productId: string; name: string; quantity: number; value: number }[];
  topNearExpiryProducts: { productId: string; name: string; quantity: number; value: number }[];
  expiryByCategory: { categoryId: string; category: string; value: number }[];
  expiryBySupplier: { supplierId: string; supplier: string; value: number }[];
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
  const batches = await inventoryRepo.listInventoryBatches(storeId);
  const summaryMap = new Map<string, { count: number; units: number }>();
  for (const m of movements) {
    const existing = summaryMap.get(m.movement_type) ?? { count: 0, units: 0 };
    existing.count += 1;
    existing.units += Math.abs(m.quantity_delta);
    summaryMap.set(m.movement_type, existing);
  }

  const today = new Date();
  const plus7 = new Date(today);
  plus7.setDate(today.getDate() + 7);
  const plus14 = new Date(today);
  plus14.setDate(today.getDate() + 14);
  const plus30 = new Date(today);
  plus30.setDate(today.getDate() + 30);

  let expiredItems = 0;
  let expiringIn7Days = 0;
  let expiringIn14Days = 0;
  let expiringIn30Days = 0;
  let expiryLossValue = 0;
  const byExpiredProduct = new Map<string, { quantity: number; value: number }>();
  const byNearProduct = new Map<string, { quantity: number; value: number }>();
  const byCategory = new Map<string, number>();
  const bySupplier = new Map<string, number>();

  for (const batch of batches) {
    if (!batch.expiry_date || batch.remaining_quantity <= 0) continue;
    const product = productMap.get(batch.product_id);
    if (!product) continue;
    const expiry = new Date(batch.expiry_date);
    const value = batch.remaining_quantity * product.base_price;
    const categoryKey = product.category_id || "uncategorized";
    const supplierKey = batch.supplier_id ?? "unknown";
    if (expiry < today) {
      expiredItems += 1;
      expiryLossValue += value;
      const p = byExpiredProduct.get(batch.product_id) ?? { quantity: 0, value: 0 };
      p.quantity += batch.remaining_quantity;
      p.value += value;
      byExpiredProduct.set(batch.product_id, p);
      byCategory.set(categoryKey, (byCategory.get(categoryKey) ?? 0) + value);
      bySupplier.set(supplierKey, (bySupplier.get(supplierKey) ?? 0) + value);
    } else if (expiry <= plus7) {
      expiringIn7Days += 1;
      const p = byNearProduct.get(batch.product_id) ?? { quantity: 0, value: 0 };
      p.quantity += batch.remaining_quantity;
      p.value += value;
      byNearProduct.set(batch.product_id, p);
    } else if (expiry <= plus14) {
      expiringIn14Days += 1;
    } else if (expiry <= plus30) {
      expiringIn30Days += 1;
    }
  }

  const expiredWasteUnits = movements
    .filter((m) => m.movement_type === "waste")
    .reduce((sum, m) => sum + Math.abs(m.quantity_delta), 0);
  const expiredWastePercent = totalUnits > 0 ? (expiredWasteUnits / totalUnits) * 100 : 0;

  const topExpiredProducts = [...byExpiredProduct.entries()]
    .map(([productId, data]) => ({
      productId,
      name: productMap.get(productId)?.name ?? "Unknown",
      quantity: data.quantity,
      value: data.value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const topNearExpiryProducts = [...byNearProduct.entries()]
    .map(([productId, data]) => ({
      productId,
      name: productMap.get(productId)?.name ?? "Unknown",
      quantity: data.quantity,
      value: data.value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

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
    expiredItems,
    expiringIn7Days,
    expiringIn14Days,
    expiringIn30Days,
    expiryLossValue,
    expiryWastePercent: expiredWastePercent,
    topExpiredProducts,
    topNearExpiryProducts,
    expiryByCategory: [...byCategory.entries()].map(([categoryId, value]) => ({
      categoryId,
      category: categoryId,
      value,
    })),
    expiryBySupplier: [...bySupplier.entries()].map(([supplierId, value]) => ({
      supplierId,
      supplier: supplierId,
      value,
    })),
  };
}
