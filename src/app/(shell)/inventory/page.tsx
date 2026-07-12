import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import type { ProductType } from "@/lib/types";
import { InventoryHub } from "@/modules/inventory/components/inventory-hub";
import { getInventoryHubData } from "@/modules/inventory/services/hub.service";

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
  const data = await getInventoryHubData({
    storeId,
    requestedWarehouseId: params?.warehouse,
    productType: parseProductType(params?.type),
  });

  return (
    <InventoryHub
      storeName={data.storeName}
      healthScore={data.healthScore}
      healthLabel={data.healthLabel}
      lowCount={data.lowCount}
      totalSkus={data.totalSkus}
      stockGroups={data.stockGroups}
      alerts={data.alerts}
      expiryAlerts={data.expiryAlerts}
      movements={data.movements}
      reorderSuggestions={data.reorderSuggestions}
      warehouses={data.warehouses}
      selectedWarehouseId={data.selectedWarehouseId}
      selectedProductType={data.selectedProductType}
    />
  );
}
