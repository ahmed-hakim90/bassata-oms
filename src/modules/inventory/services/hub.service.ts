import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import type { ProductType, Warehouse } from "@/lib/types";
import { levelsToAlerts, type InventoryAlert } from "@/modules/inventory/services/alert.service";
import { summarizeExpiryBatches, type ExpiryBatchAlert } from "@/modules/inventory/services/expiry.service";
import { attachMovementNames, type MovementTimelineItem } from "@/modules/inventory/services/movement.service";
import {
  averageDailyUsageByStockKey,
  buildReorderSuggestions,
  type ReorderSuggestion,
} from "@/modules/inventory/services/reorder.service";
import {
  attachProductsToLevels,
  buildStockCategoryGroups,
  resolveStockLevels,
  toLowStockViews,
  type StockCategoryGroup,
  type StockLevelView,
} from "@/modules/inventory/services/stock.service";

const TIMELINE_LIMIT = 20;
const CONSUMPTION_LOOKBACK_DAYS = 30;
const CONSUMPTION_MOVEMENT_LIMIT = 1000;

export interface InventoryHubData {
  storeName: string;
  warehouses: Warehouse[];
  selectedWarehouseId: string | undefined;
  selectedProductType: ProductType | undefined;
  stockGroups: StockCategoryGroup[];
  alerts: InventoryAlert[];
  expiryAlerts: ExpiryBatchAlert[];
  movements: MovementTimelineItem[];
  reorderSuggestions: ReorderSuggestion[];
  healthScore: number;
  healthLabel: string;
  lowCount: number;
  totalSkus: number;
}

/**
 * One shared data pass for `/inventory` — avoids N× products/stock/warehouse refetch
 * across stock groups, alerts, expiry, movements, and reorder suggestions.
 */
export async function getInventoryHubData(input: {
  storeId: string;
  requestedWarehouseId?: string;
  productType?: ProductType;
}): Promise<InventoryHubData> {
  const { storeId, productType } = input;

  const [store, warehouses] = await Promise.all([
    storeRepo.getStore(storeId),
    warehouseRepo.listWarehouses(storeId),
  ]);

  const selectedWarehouseId = warehouses.some((w) => w.id === input.requestedWarehouseId)
    ? input.requestedWarehouseId
    : undefined;

  const consumptionFrom = new Date();
  consumptionFrom.setDate(consumptionFrom.getDate() - CONSUMPTION_LOOKBACK_DAYS);

  const [rawLevels, products, categories, recentMovements, consumptionMovements, batches] =
    await Promise.all([
      inventoryRepo.listStockLevels(storeId, selectedWarehouseId),
      catalogRepo.listProducts(),
      catalogRepo.listCategories(),
      inventoryRepo.listMovements(storeId, selectedWarehouseId, TIMELINE_LIMIT),
      inventoryRepo.listMovements(storeId, selectedWarehouseId, CONSUMPTION_MOVEMENT_LIMIT, {
        from: consumptionFrom.toISOString(),
        movementTypes: ["sale", "waste", "transfer_out"],
      }),
      inventoryRepo.listInventoryBatches(storeId, selectedWarehouseId),
    ]);

  const levels = attachProductsToLevels(
    resolveStockLevels(rawLevels, selectedWarehouseId),
    products
  );
  const stockGroups = buildStockCategoryGroups(levels, categories, products, productType);
  const lowStock = toLowStockViews(levels, products);
  const alerts = levelsToAlerts(lowStock);
  const expiryAlerts = summarizeExpiryBatches(batches, products);
  const movements = attachMovementNames(recentMovements, products, warehouses);
  // Reorder drafts need concrete warehouse_id; aggregated all-warehouse view blanks it.
  const reorderLevels: StockLevelView[] = selectedWarehouseId
    ? lowStock
    : toLowStockViews(attachProductsToLevels(rawLevels, products), products);
  const reorderSuggestions = buildReorderSuggestions(
    reorderLevels,
    warehouses,
    averageDailyUsageByStockKey(consumptionMovements)
  );

  const totalSkus = stockGroups.reduce((s, g) => s + g.items.length, 0);
  const lowCount = alerts.length;
  const healthScore =
    totalSkus > 0 ? Math.max(0, Math.round(100 - (lowCount / totalSkus) * 100)) : 100;
  const healthLabel =
    healthScore >= 80 ? "سليم" : healthScore >= 50 ? "يحتاج متابعة" : "حرج";

  return {
    storeName: store?.name ?? "الفرع",
    warehouses,
    selectedWarehouseId,
    selectedProductType: productType,
    stockGroups,
    alerts,
    expiryAlerts,
    movements,
    reorderSuggestions,
    healthScore,
    healthLabel,
    lowCount,
    totalSkus,
  };
}
