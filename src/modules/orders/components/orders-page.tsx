import Link from "next/link";
import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import * as storeRepo from "@/lib/repositories/store.repository";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { buttonVariants } from "@/components/ui/button";
import { OrdersTable } from "@/modules/orders/components/orders-table";
import { listOrders } from "@/modules/orders/services/order.service";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function OrdersPage() {
  const storeResult = await requirePageStoreId("/orders");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }
  const storeId = storeResult.storeId;
  const [store, activity] = await Promise.all([
    storeRepo.getStore(storeId),
    getBusinessActivitySettings(),
  ]);
  const orders = (await listOrders(storeId)).map((o) => ({
    ...o,
    storeName: store?.name ?? "الفرع",
  }));

  const completed = orders.filter((o) => o.status === "completed");
  const voided = orders.filter((o) => o.status === "voided" || o.status === "refunded");
  const salesTotal = completed.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={<span>المبيعات · الطلبات</span>}
        title="الطلبات"
        description="فواتير مكتملة وملغاة — راجع وأعد الطباعة عند الحاجة"
        action={
          activity.enable_wholesale_sales ? (
            <Link
              href="/sales-invoices"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
            >
              فاتورة جملة جديدة
            </Link>
          ) : undefined
        }
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
