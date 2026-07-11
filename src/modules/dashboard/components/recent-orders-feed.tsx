import Link from "next/link";
import { format } from "date-fns";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";

interface RecentOrdersFeedProps {
  orders: Order[];
}

export function RecentOrdersFeed({ orders }: RecentOrdersFeedProps) {
  return (
    <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-5)] text-card-foreground shadow-[var(--mds-elevation-1)]">
      <div className="mb-[var(--mds-space-4)] flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">آخر الطلبات</h3>
        <Link
          href="/orders"
          className="text-xs font-medium text-primary hover:underline"
        >
          عرض الكل
        </Link>
      </div>
      {orders.length === 0 ? (
        <EmptyStateBlock
          title="مفيش طلبات النهاردة لسة"
          className="p-[var(--mds-space-4)]"
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center justify-between rounded-[var(--mds-radius-md)] px-[var(--mds-space-2)] py-[var(--mds-space-2)] transition-colors hover:bg-muted/60"
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
