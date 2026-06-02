import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { listOnlineOrders } from "@/modules/online-orders/services/online-order.service";
import { OnlineOrdersQueue } from "@/modules/online-orders/components/online-orders-queue";

export async function OnlineOrdersPage() {
  const storeId = await getValidatedActiveStoreId();
  const orders = await listOnlineOrders(storeId);

  return (
    <div className="space-y-6">
      <PageHeader title="Online Orders" description="QR menu requests for the active branch" />
      <OnlineOrdersQueue orders={orders} />
    </div>
  );
}
