import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import type { ProductType } from "@/lib/types";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { InventoryHub } from "@/modules/inventory/components/inventory-hub";
import { getAlerts } from "@/modules/inventory/services/alert.service";
import { getMovementTimeline } from "@/modules/inventory/services/movement.service";
import { getReorderSuggestions } from "@/modules/inventory/services/reorder.service";
import { groupStockByCategory } from "@/modules/inventory/services/stock.service";
import { getExpiryBatchAlerts } from "@/modules/inventory/services/expiry.service";

function parseProductType(value?: string): ProductType | undefined {
  if (value === "finished" || value === "ingredient") return value;
  return undefined;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ warehouse?: string; type?: string }>;
}) {
  const storeId = await getValidatedActiveStoreId();
  const params = await searchParams;
  const requestedWarehouseId = params?.warehouse;
  const productType = parseProductType(params?.type);
  const store = await storeRepo.getStore(storeId);
  const warehouses = await warehouseRepo.listWarehouses(storeId);
  const selectedWarehouseId = warehouses.some((w) => w.id === requestedWarehouseId)
    ? requestedWarehouseId
    : undefined;
  const [stockGroups, alerts, expiryAlerts, movements, reorderSuggestions] = await Promise.all([
    groupStockByCategory(storeId, selectedWarehouseId, productType),
    getAlerts(storeId, selectedWarehouseId),
    getExpiryBatchAlerts(storeId, selectedWarehouseId),
    getMovementTimeline(storeId, selectedWarehouseId),
    getReorderSuggestions(storeId, selectedWarehouseId),
  ]);

  const totalSkus = stockGroups.reduce((s, g) => s + g.items.length, 0);
  const lowCount = alerts.length;
  const healthScore =
    totalSkus > 0 ? Math.max(0, Math.round(100 - (lowCount / totalSkus) * 100)) : 100;
  const healthLabel =
    healthScore >= 80 ? "سليم" : healthScore >= 50 ? "يحتاج متابعة" : "حرج";

  return (
    <InventoryHub
      storeName={store?.name ?? "الفرع"}
      healthScore={healthScore}
      healthLabel={healthLabel}
      lowCount={lowCount}
      totalSkus={totalSkus}
      stockGroups={stockGroups}
      alerts={alerts}
      expiryAlerts={expiryAlerts}
      movements={movements}
      reorderSuggestions={reorderSuggestions}
      warehouses={warehouses}
      selectedWarehouseId={selectedWarehouseId}
      selectedProductType={productType}
    />
  );
}
