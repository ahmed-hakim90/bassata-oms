"use client";

import { format } from "date-fns";
import { Printer } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { OrderWithDetails } from "@/modules/orders/services/order.service";
import { refundOrderAction, voidOrderAction } from "@/modules/orders/actions/order.actions";

interface OrderDetailProps {
  order: OrderWithDetails;
}

export function OrderDetail({ order }: OrderDetailProps) {
  const [pending, startTransition] = useTransition();

  function handlePrint() {
    window.open(`/print/orders/${order.id}`, "_blank", "noopener,noreferrer");
  }

  function handleVoid() {
    if (!confirm("Void this order and restore stock?")) return;
    startTransition(async () => {
      try {
        await voidOrderAction(order.id);
        toast.success("Order voided");
        window.location.reload();
      } catch {
        toast.error("Could not void order");
      }
    });
  }

  function handleRefund() {
    if (!confirm("Refund this order and restore stock?")) return;
    startTransition(async () => {
      try {
        await refundOrderAction(order.id);
        toast.success("Order refunded");
        window.location.reload();
      } catch {
        toast.error("Could not refund order");
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {order.order_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.storeName} · {format(new Date(order.created_at), "PPpp")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" />
            Print
          </Button>
          {order.status === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={handleRefund}
              >
                Refund
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={handleVoid}
              >
                Void
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm print:shadow-none print:ring-0">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">CafeFlow</CardTitle>
          <p className="text-xs text-muted-foreground">{order.storeName}</p>
          <Badge className="mx-auto w-fit" variant="outline">
            {order.status}
          </Badge>
          <Badge className="mx-auto w-fit capitalize" variant="secondary">
            {order.payment_status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.customerName && (
            <p className="text-sm">
              <span className="text-muted-foreground">Customer: </span>
              {order.customerName}
            </p>
          )}
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {item.quantity}× {item.productName}
                </span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(item.line_total)}
                </span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {order.status === "refunded" && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Refunded</span>
                <span>-{formatCurrency(order.total)}</span>
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-1">
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm capitalize">
                <span>{p.method}</span>
                <span className="tabular-nums">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground print:mt-8">
            Thank you for visiting CafeFlow!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
