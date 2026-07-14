import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { MovementTimeline } from "@/modules/inventory/components/movement-timeline";
import { getMovementTimeline } from "@/modules/inventory/services/movement.service";

export default async function MovementsPage() {
  const storeResult = await requirePageStoreId("/inventory/movements");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }
  const storeId = storeResult.storeId;
  const store = await storeRepo.getStore(storeId);
  const movements = await getMovementTimeline(storeId, undefined, 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="الحركات"
        description={`سجل المخزون - ${store?.name ?? "الفرع"}`}
      />
      <MovementTimeline movements={movements} />
    </div>
  );
}
