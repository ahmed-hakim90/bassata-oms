"use client";

import Link from "next/link";
import { Check, ChefHat, CircleDollarSign, FilePlus2, X } from "lucide-react";
import { format } from "date-fns";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import {
  createOnlineOrderInvoiceAction,
  markOrderPaidAction,
  updateOnlineOrderStatusAction,
} from "@/modules/online-orders/actions/online-order.actions";
import type { OnlineOrderWithDetails } from "@/modules/online-orders/services/online-order.service";
import type { OnlineOrderStatus } from "@/lib/types";

const GROUPS = {
  pending: ["pending"],
  active: ["accepted", "preparing", "ready"],
  closed: ["invoiced", "cancelled"],
} as const;

export function OnlineOrdersQueue({ orders }: { orders: OnlineOrderWithDetails[] }) {
  return (
    <Tabs defaultValue="pending" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="active">Preparing</TabsTrigger>
        <TabsTrigger value="closed">Closed</TabsTrigger>
      </TabsList>
      {Object.entries(GROUPS).map(([group, statuses]) => (
        <TabsContent key={group} value={group}>
          <OrderList
            orders={orders.filter((order) =>
              (statuses as readonly OnlineOrderStatus[]).includes(order.status)
            )}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function statusLabel(order: OnlineOrderWithDetails): string {
  if (order.source === "souqna" && order.status === "pending") {
    return "New Online Order";
  }
  return order.status;
}

function paymentLabel(method: string | null): string {
  if (!method) return "";
  if (method === "cash_on_delivery") return "COD";
  return method;
}

function OrderList({ orders }: { orders: OnlineOrderWithDetails[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg bg-white p-10 text-center text-sm text-muted-foreground ring-1 ring-black/5">
        No online orders in this lane
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {orders.map((order) => (
        <OnlineOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OnlineOrderCard({ order }: { order: OnlineOrderWithDetails }) {
  const [pending, startTransition] = useTransition();

  function run(label: string, action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
        toast.success(label);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  return (
    <article className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{order.customer_name}</h2>
            {order.source === "souqna" ? (
              <Badge variant="secondary">Souqna</Badge>
            ) : null}
            <Badge variant={order.status === "cancelled" ? "destructive" : "outline"}>
              {statusLabel(order)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.created_at), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
          {order.source === "souqna" && order.delivery_address ? (
            <p className="mt-1 text-sm">
              {order.fulfillment_type === "delivery" ? "Delivery" : order.fulfillment_type}
              {order.delivery_area ? ` · ${order.delivery_area}` : ""}
              {order.delivery_address ? ` · ${order.delivery_address}` : ""}
              {order.delivery_fee > 0 ? ` · Fee ${formatCurrency(order.delivery_fee)}` : ""}
            </p>
          ) : null}
          {order.payment_method ? (
            <p className="text-xs text-muted-foreground">
              Payment: {paymentLabel(order.payment_method)}
            </p>
          ) : null}
          {order.notes && <p className="mt-1 text-sm">{order.notes}</p>}
        </div>
        <div className="text-left md:text-right">
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(order.total)}</p>
          <p className="text-xs text-muted-foreground">{order.storeName}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y rounded-lg border">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              {item.quantity}x {item.productName}
              {item.variantName ? ` · ${item.variantName}` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{formatCurrency(item.line_total)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === "pending" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run("Order accepted", () => updateOnlineOrderStatusAction(order.id, "accepted"))
            }
          >
            <Check className="size-4" />
            Accept
          </Button>
        )}
        {(order.status === "accepted" || order.status === "pending") && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run("Order is preparing", () =>
                updateOnlineOrderStatusAction(order.id, "preparing")
              )
            }
          >
            <ChefHat className="size-4" />
            Prepare
          </Button>
        )}
        {order.status === "preparing" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run("Order is ready", () => updateOnlineOrderStatusAction(order.id, "ready"))
            }
          >
            <Check className="size-4" />
            Ready
          </Button>
        )}
        {order.status !== "cancelled" && order.status !== "invoiced" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run("Invoice created", () => createOnlineOrderInvoiceAction(order.id))
            }
          >
            <FilePlus2 className="size-4" />
            Create invoice
          </Button>
        )}
        {order.order_id && (
          <>
            <Link
              href={`/orders/${order.order_id}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              View invoice
            </Link>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run("Invoice marked paid", () => markOrderPaidAction(order.order_id!))}
            >
              <CircleDollarSign className="size-4" />
              Mark paid
            </Button>
          </>
        )}
        {order.status !== "cancelled" && order.status !== "invoiced" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run("Order cancelled", () => updateOnlineOrderStatusAction(order.id, "cancelled"))
            }
          >
            <X className="size-4" />
            Cancel
          </Button>
        )}
      </div>
    </article>
  );
}
