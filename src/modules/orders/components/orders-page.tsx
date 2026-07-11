import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { OrdersTable } from "@/modules/orders/components/orders-table";
import { listOrders } from "@/modules/orders/services/order.service";
import { formatCurrency } from "@/lib/format";

export async function OrdersPage() {
  const storeId = await getValidatedActiveStoreId();
  const store = await storeRepo.getStore(storeId);
  const orders = (await listOrders(storeId)).map((o) => ({
    ...o,
    storeName: store?.name ?? "الفرع",
  }));

  const completed = orders.filter((o) => o.status === "completed");
  const voided = orders.filter((o) => o.status === "voided" || o.status === "refunded");
  const salesTotal = completed.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>المبيعات · الطلبات</span>}
        title="الطلبات"
        description="فواتير مكتملة وملغاة — راجع وأعد الطباعة عند الحاجة"
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <OperationalCard
          title="إجمالي المبيعات"
          value={formatCurrency(salesTotal)}
          subtitle={`${completed.length} طلب مكتمل`}
        />
        <OperationalCard
          title="كل الطلبات"
          value={String(orders.length)}
          subtitle={store?.name ?? "الفرع"}
          accent="var(--mds-color-feedback-info)"
        />
        <OperationalCard
          title="ملغي / مسترد"
          value={String(voided.length)}
          subtitle="يحتاج مراجعة عند الارتفاع"
          accent="var(--mds-color-feedback-danger)"
        />
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}
