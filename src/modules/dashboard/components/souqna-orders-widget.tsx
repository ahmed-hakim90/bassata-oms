import Link from "next/link";
import { Bell, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

export interface SouqnaDashboardOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  created_at: string;
  fulfillment_type: string | null;
}

interface SouqnaOrdersWidgetProps {
  pendingCount: number;
  recentOrders: SouqnaDashboardOrder[];
  currency: string;
}

export function SouqnaOrdersWidget({
  pendingCount,
  recentOrders,
  currency,
}: SouqnaOrdersWidgetProps) {
  if (pendingCount === 0 && recentOrders.length === 0) {
    return null;
  }

  return (
    <OperationalCard
      title="Souqna online orders"
      description="Orders imported from Souqna marketplace"
    >
      {pendingCount > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <Bell className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">طلب جديد من سوقنا</p>
            <p className="mt-0.5">
              {pendingCount === 1
                ? "You have 1 new online order from Souqna."
                : `You have ${pendingCount} new online orders from Souqna.`}
            </p>
          </div>
        </div>
      ) : null}

      {recentOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Souqna orders yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {recentOrders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ShoppingBag className="size-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{order.customer_name}</span>
                  <Badge variant="secondary">Souqna</Badge>
                  {order.status === "pending" ? (
                    <Badge variant="outline">New Online Order</Badge>
                  ) : (
                    <Badge variant="outline">{order.status}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.customer_phone} · {format(new Date(order.created_at), "MMM d, h:mm a")}
                  {order.fulfillment_type ? ` · ${order.fulfillment_type}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(order.total, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Link href="/orders/online" className={buttonVariants({ variant: "outline", size: "sm" })}>
          View online orders
        </Link>
      </div>
    </OperationalCard>
  );
}
