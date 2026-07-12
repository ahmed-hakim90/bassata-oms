import type { StockLevelView } from "./stock.service";
import { getLowStock } from "./stock.service";

export type InventoryAlertType = "low_stock" | "out_of_stock" | "reorder_soon";

export interface InventoryAlert {
  id: string;
  type: InventoryAlertType;
  title: string;
  message: string;
  productId: string;
  storeId: string;
  warehouseId: string;
  severity: "warning" | "danger" | "info";
  quantity: number;
  reorderPoint: number;
}

function levelToAlert(level: StockLevelView): InventoryAlert {
  const type: InventoryAlertType =
    level.quantity === 0
      ? "out_of_stock"
      : level.quantity <= Math.max(1, Math.floor(level.reorder_point * 0.5))
        ? "reorder_soon"
        : "low_stock";

  const severity: InventoryAlert["severity"] =
    type === "out_of_stock" ? "danger" : type === "reorder_soon" ? "warning" : "warning";

  return {
    id: `alert-${level.id}`,
    type,
    title: level.product.name,
    message:
      type === "out_of_stock"
        ? "Out of stock at this location"
        : `${level.quantity} units left (reorder at ${level.reorder_point})`,
    productId: level.product_id,
    storeId: level.store_id,
    warehouseId: level.warehouse_id,
    severity,
    quantity: level.quantity,
    reorderPoint: level.reorder_point,
  };
}

export function levelsToAlerts(low: StockLevelView[]): InventoryAlert[] {
  return low
    .map(levelToAlert)
    .sort((a, b) => {
      const order = { danger: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
}

export async function getAlerts(storeId: string, warehouseId?: string): Promise<InventoryAlert[]> {
  const low = await getLowStock(storeId, warehouseId);
  return levelsToAlerts(low);
}
