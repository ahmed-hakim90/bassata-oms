import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OrdersTable } from "@/modules/orders/components/orders-table";
import { listOrders } from "@/modules/orders/services/order.service";

export async function OrdersPage() {
  const storeId = await getValidatedActiveStoreId();
  const store = await storeRepo.getStore(storeId);
  const orders = (await listOrders(storeId)).map((o) => ({
    ...o,
    storeName: store?.name ?? "Store",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Completed and voided transactions" />
      <OrdersTable orders={orders} />
    </div>
  );
}
