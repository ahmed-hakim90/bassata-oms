"use client";

import { Printer } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/modules/orders/services/order.service";
import { refundOrderAction, voidOrderAction } from "@/modules/orders/actions/order.actions";

const STATUS_LABELS: Record<string, string> = {
  completed: "مكتمل",
  voided: "ملغي",
  refunded: "مسترد",
  pending: "قيد الانتظار",
  open: "مفتوح",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partial: "جزئي",
  refunded: "مسترد",
};

interface OrderDetailProps {
  order: OrderWithDetails;
}

export function OrderDetail({ order }: OrderDetailProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"void" | "refund" | null>(null);

  function handlePrint() {
    window.open(`/print/orders/${order.id}`, "_blank", "noopener,noreferrer");
  }

  function runAction(kind: "void" | "refund") {
    startTransition(async () => {
      try {
        if (kind === "void") {
          await voidOrderAction(order.id);
          toast.success("تم إلغاء الطلب");
        } else {
          await refundOrderAction(order.id);
          toast.success("تم رد الطلب");
        }
        window.location.reload();
      } catch {
        toast.error(kind === "void" ? "تعذر إلغاء الطلب" : "تعذر رد الطلب");
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
            {order.storeName} ·{" "}
            {new Date(order.created_at).toLocaleString("ar-EG", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" />
            طباعة
          </Button>
          {order.status === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfirm("refund")}
              >
                رد
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => setConfirm("void")}
              >
                إلغاء
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm print:shadow-none print:ring-0">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">CafeFlow</CardTitle>
          <p className="text-xs text-muted-foreground">{order.storeName}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant={
                order.status === "completed"
                  ? "secondary"
                  : order.status === "voided" || order.status === "refunded"
                    ? "destructive"
                    : "outline"
              }
              className={cn(
                order.status === "completed" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              )}
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <Badge
              variant={
                order.payment_status === "paid"
                  ? "secondary"
                  : order.payment_status === "unpaid"
                    ? "outline"
                    : "default"
              }
              className={cn(
                order.payment_status === "paid" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
                order.payment_status === "unpaid" &&
                  "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              )}
            >
              {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.customerName && (
            <p className="text-sm">
              <span className="text-muted-foreground">العميل: </span>
              {order.customerName}
            </p>
          )}
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {item.quantity}× {item.productName}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(item.line_total)}
                </span>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي الفرعي</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الخصم</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>الإجمالي</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {order.status === "refunded" && (
              <div className="flex justify-between text-sm text-destructive">
                <span>مسترد</span>
                <span>-{formatCurrency(order.total)}</span>
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-1">
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{t(p.method)}</span>
                <span className="tabular-nums">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground print:mt-8">
            شكرًا لزيارتك!
          </p>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={confirm === "void"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="إلغاء هذا الطلب؟"
        description="هيتلغى الطلب ويترجع المخزون للرصيد. الإجراء ده مش هيتراجع بسهولة."
        confirmLabel="إلغاء الطلب"
        destructive
        onConfirm={() => runAction("void")}
      />
      <ConfirmActionDialog
        open={confirm === "refund"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="رد هذا الطلب؟"
        description="هيتسجّل كمسترد ويترجع المخزون. تأكد إن الفلوس رجعت للعميل."
        confirmLabel="تأكيد الرد"
        destructive
        onConfirm={() => runAction("refund")}
      />
    </div>
  );
}
