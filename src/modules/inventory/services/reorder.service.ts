import { formatUnit } from "@/lib/units";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import type { InventoryMovement, MovementType, Warehouse } from "@/lib/types";
import type { StockLevelView } from "@/modules/inventory/services/stock.service";
import { getLowStock } from "@/modules/inventory/services/stock.service";

export interface ReorderSuggestion {
  id: string;
  productId: string;
  warehouseId: string;
  productName: string;
  warehouseName: string;
  quantity: number;
  reorderPoint: number;
  suggestedQuantity: number;
  estimatedCost: number;
  averageDailyUsage: number;
  daysCover: number | null;
  priority: "urgent" | "soon";
  message: string;
}

const CONSUMPTION_MOVEMENT_TYPES: MovementType[] = ["sale", "waste", "transfer_out"];
const CONSUMPTION_LOOKBACK_DAYS = 30;
const TARGET_COVER_DAYS = 14;

export function getConsumptionKey(input: {
  warehouse_id: string;
  product_id: string;
  variant_id: string | null;
}) {
  return `${input.warehouse_id}:${input.product_id}:${input.variant_id ?? ""}`;
}

export function stockLevelToReorderSuggestion(
  level: StockLevelView,
  warehouseName: string,
  averageDailyUsage = 0
): ReorderSuggestion | null {
  if (!level.product.track_inventory || level.reorder_point <= 0) return null;
  if (level.quantity > level.reorder_point) return null;

  const reorderTarget = level.reorder_point * 2;
  const consumptionTarget = Math.ceil(averageDailyUsage * TARGET_COVER_DAYS);
  const targetQuantity = Math.max(reorderTarget, consumptionTarget);
  const suggestedQuantity = Math.max(1, Math.ceil(targetQuantity - level.quantity));
  const priority = level.quantity <= Math.max(0, level.reorder_point * 0.5) ? "urgent" : "soon";
  const estimatedCost = suggestedQuantity * level.product.last_unit_cost;
  const daysCover = averageDailyUsage > 0 ? level.quantity / averageDailyUsage : null;
  const unit = formatUnit(level.product.cost_unit ?? level.product.unit);
  const coverText =
    averageDailyUsage > 0
      ? ` Covers ${Math.max(0, daysCover ?? 0).toFixed(1)} days at recent usage.`
      : "";

  return {
    id: `reorder-${level.id}`,
    productId: level.product_id,
    warehouseId: level.warehouse_id,
    productName: level.product.name,
    warehouseName,
    quantity: level.quantity,
    reorderPoint: level.reorder_point,
    suggestedQuantity,
    estimatedCost,
    averageDailyUsage,
    daysCover,
    priority,
    message: `Order ${suggestedQuantity} ${unit} to reach ${targetQuantity} ${unit}.${coverText}`,
  };
}

function consumptionCutoffIso(lookbackDays = CONSUMPTION_LOOKBACK_DAYS): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  return cutoff.toISOString();
}

export function averageDailyUsageByStockKey(
  movements: InventoryMovement[],
  lookbackDays = CONSUMPTION_LOOKBACK_DAYS
): Map<string, number> {
  const consumptionTypes = new Set<string>(CONSUMPTION_MOVEMENT_TYPES);
  const usage = new Map<string, number>();

  for (const movement of movements) {
    if (!consumptionTypes.has(movement.movement_type)) continue;
    if (movement.quantity_delta >= 0) continue;
    const key = getConsumptionKey(movement);
    usage.set(key, (usage.get(key) ?? 0) + Math.abs(movement.quantity_delta));
  }

  return new Map(
    [...usage.entries()].map(([key, quantity]) => [key, quantity / lookbackDays])
  );
}

async function getAverageDailyUsageByStockKey(storeId: string, warehouseId?: string) {
  const movements = await inventoryRepo.listMovements(storeId, warehouseId, 1000, {
    from: consumptionCutoffIso(),
    movementTypes: CONSUMPTION_MOVEMENT_TYPES,
  });
  return averageDailyUsageByStockKey(movements);
}

export function buildReorderSuggestions(
  levels: StockLevelView[],
  warehouses: Warehouse[],
  usageByKey: Map<string, number>
): ReorderSuggestion[] {
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));

  return levels
    .map((level) =>
      stockLevelToReorderSuggestion(
        level,
        warehouseMap.get(level.warehouse_id) ?? "Unknown warehouse",
        usageByKey.get(getConsumptionKey(level)) ?? 0
      )
    )
    .filter((suggestion): suggestion is ReorderSuggestion => Boolean(suggestion))
    .sort((a, b) => {
      const priority = { urgent: 0, soon: 1 };
      return priority[a.priority] - priority[b.priority] || b.estimatedCost - a.estimatedCost;
    });
}

export async function getReorderSuggestions(
  storeId: string,
  warehouseId?: string,
  preloaded?: {
    levels?: StockLevelView[];
    warehouses?: Warehouse[];
    consumptionMovements?: InventoryMovement[];
  }
): Promise<ReorderSuggestion[]> {
  const [levels, warehouses] = await Promise.all([
    preloaded?.levels
      ? Promise.resolve(preloaded.levels)
      : getLowStock(storeId, warehouseId),
    preloaded?.warehouses
      ? Promise.resolve(preloaded.warehouses)
      : warehouseRepo.listWarehouses(storeId),
  ]);
  const usageByKey = preloaded?.consumptionMovements
    ? averageDailyUsageByStockKey(preloaded.consumptionMovements)
    : await getAverageDailyUsageByStockKey(storeId, warehouseId);

  return buildReorderSuggestions(levels, warehouses, usageByKey);
}
