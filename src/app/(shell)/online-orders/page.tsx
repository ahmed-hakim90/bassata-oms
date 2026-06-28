import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OnlineOrdersPageClient } from "@/modules/online-orders/components/online-orders-page";
import {
  listOnlineOrdersWithItems,
  listStaffOnlineProductOptions,
} from "@/modules/online-orders/services/online-order.service";

export default async function OnlineOrdersRoute() {
  const storeId = await getValidatedActiveStoreId();
  const [orders, products] = await Promise.all([
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="طلبات المنيو الأونلاين"
        description="راجع الطلبات القادمة من الرابط العام، عدّلها أو ألغها أو حوّلها إلى فاتورة."
      />
      <OnlineOrdersPageClient orders={orders} products={products} />
    </div>
  );
}
