import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { MovementTimeline } from "@/modules/inventory/components/movement-timeline";
import { getMovementTimeline } from "@/modules/inventory/services/movement.service";

export default async function MovementsPage() {
  const storeId = await getValidatedActiveStoreId();
  const store = await storeRepo.getStore(storeId);
  const movements = await getMovementTimeline(storeId, undefined, 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movements"
        description={`Stock history — ${store?.name ?? "Store"}`}
      />
      <MovementTimeline movements={movements} />
    </div>
  );
}
