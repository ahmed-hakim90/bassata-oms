import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { PublicTrackedOnlineOrder } from "@/modules/online-orders/services/online-order-tracking.service";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrderTrackingPage({ order }: { order: PublicTrackedOnlineOrder }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_35%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <header className="rounded-3xl border border-border/50 bg-card/95 p-6 backdrop-blur">
          <p className="text-sm text-muted-foreground">{order.storeName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">تتبع طلبك</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            رقم المتابعة: <span className="font-mono text-foreground">{order.id.slice(0, 8)}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge>{order.statusLabelAr}</Badge>
            <Badge variant="secondary">{order.fulfillmentLabelAr}</Badge>
          </div>
        </header>

        <section className="rounded-3xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">التفاصيل</h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">العميل</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">وقت الطلب</dt>
              <dd className="tabular-nums">{formatWhen(order.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">آخر تحديث</dt>
              <dd className="tabular-nums">{formatWhen(order.updatedAt)}</dd>
            </div>
            {order.fulfillmentType === "delivery" ? (
              <>
                {order.deliveryArea ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">المنطقة</dt>
                    <dd className="font-medium">{order.deliveryArea}</dd>
                  </div>
                ) : null}
                {order.deliveryAddress ? (
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">العنوان</dt>
                    <dd className="rounded-2xl bg-muted/50 px-3 py-2">{order.deliveryAddress}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>
        </section>

        <section className="rounded-3xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">الأصناف ({order.itemCount})</h2>
          <ul className="mt-3 divide-y divide-border/40">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {item.name} × {item.quantity}
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatCurrency(item.lineTotal, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1 border-t border-border/40 pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع</span>
              <span className="tabular-nums">{formatCurrency(order.subtotal, order.currency)}</span>
            </div>
            {order.deliveryFee > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>رسوم التوصيل</span>
                <span className="tabular-nums">{formatCurrency(order.deliveryFee, order.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          هذه الصفحة للتتبع فقط ولا تحتاج تسجيل دخول. لا تشارك الرابط.
        </p>
      </div>
    </main>
  );
}
