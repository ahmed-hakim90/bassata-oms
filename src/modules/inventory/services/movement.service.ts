import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import type { InventoryMovement } from "@/lib/types";

export interface MovementWithProduct extends InventoryMovement {
  productName: string;
  warehouseName: string;
}

export async function listMovementsWithProducts(
  storeId?: string,
  warehouseId?: string
): Promise<MovementWithProduct[]> {
  const movements = await inventoryRepo.listMovements(storeId, warehouseId);
  const [products, warehouses] = await Promise.all([
    catalogRepo.listProducts(),
    warehouseRepo.listWarehouses(storeId),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return movements.map((m) => ({
    ...m,
    productName: productMap.get(m.product_id) ?? "Unknown",
    warehouseName: warehouseMap.get(m.warehouse_id) ?? "Unknown warehouse",
  }));
}

export type MovementTimelineItem = MovementWithProduct;

export async function getMovementTimeline(
  storeId: string,
  warehouseId?: string,
  limit = 20
): Promise<MovementTimelineItem[]> {
  return listMovementsWithProducts(storeId, warehouseId).then((m) => m.slice(0, limit));
}
