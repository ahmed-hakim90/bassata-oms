import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import type { InventoryMovement, Product, Warehouse } from "@/lib/types";

export interface MovementWithProduct extends InventoryMovement {
  productName: string;
  warehouseName: string;
}

export function attachMovementNames(
  movements: InventoryMovement[],
  products: Product[],
  warehouses: Warehouse[]
): MovementWithProduct[] {
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return movements.map((m) => ({
    ...m,
    productName: productMap.get(m.product_id) ?? "Unknown",
    warehouseName: warehouseMap.get(m.warehouse_id) ?? "Unknown warehouse",
  }));
}

export async function listMovementsWithProducts(
  storeId?: string,
  warehouseId?: string,
  limit = 200,
  preloaded?: { products?: Product[]; warehouses?: Warehouse[] }
): Promise<MovementWithProduct[]> {
  const [movements, products, warehouses] = await Promise.all([
    inventoryRepo.listMovements(storeId, warehouseId, limit),
    preloaded?.products
      ? Promise.resolve(preloaded.products)
      : catalogRepo.listProducts(),
    preloaded?.warehouses
      ? Promise.resolve(preloaded.warehouses)
      : warehouseRepo.listWarehouses(storeId),
  ]);
  return attachMovementNames(movements, products, warehouses);
}

export type MovementTimelineItem = MovementWithProduct;

export async function getMovementTimeline(
  storeId: string,
  warehouseId?: string,
  limit = 20,
  preloaded?: { products?: Product[]; warehouses?: Warehouse[]; movements?: InventoryMovement[] }
): Promise<MovementTimelineItem[]> {
  if (preloaded?.movements && preloaded.products && preloaded.warehouses) {
    return attachMovementNames(
      preloaded.movements.slice(0, limit),
      preloaded.products,
      preloaded.warehouses
    );
  }
  return listMovementsWithProducts(storeId, warehouseId, limit, preloaded);
}
