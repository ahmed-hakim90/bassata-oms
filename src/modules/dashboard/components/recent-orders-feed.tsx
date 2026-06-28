import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";

interface RecentOrdersFeedProps {
  orders: Order[];
}

export function RecentOrdersFeed({ orders }: RecentOrdersFeedProps) {
  return (
    <div className="rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-border">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">Recent orders</h3>
        <Link
          href="/orders"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet today</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(o.created_at), "h:mm a")}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(o.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
