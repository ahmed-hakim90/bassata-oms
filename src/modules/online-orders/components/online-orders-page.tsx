"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  Phone,
  Plus,
  ReceiptText,
  Save,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getOnlineOrderReceiptPayloadAction,
  invoiceOnlineOrderAction,
  updateOnlineOrderDetailsAction,
  updateOnlineOrderStatusAction,
} from "@/modules/online-orders/actions/online-order.actions";
import { PaymentPanel } from "@/modules/pos/components/payment-panel";
import { ReceiptModal } from "@/modules/pos/components/receipt-modal";
import { buildReceiptPayloadFromOnlineOrder } from "@/modules/pos/utils/receipt-payload";
import type { ReceiptPayload } from "@/modules/pos/services/receipt-format.service";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import type { PaymentMethod, PaymentSplit } from "@/lib/types";
import type {
  OnlineOrderWithItems,
  StaffOnlineProductOption,
} from "@/modules/online-orders/services/online-order.service";
import type { OnlineOrderStatus } from "@/lib/types";

type DraftLine = {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
};

type Draft = {
  customerName: string;
  customerPhone: string;
  notes: string;
  lines: DraftLine[];
};

const STATUS_LABELS: Record<OnlineOrderStatus, string> = {
  pending: "معلق",
  accepted: "مقبول",
  preparing: "قيد التحضير",
  ready: "جاهز",
  cancelled: "ملغي",
  invoiced: "تم عمل ريسيت",
};

const STATUS_STYLES: Record<OnlineOrderStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  accepted: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
  preparing: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  invoiced: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
};

const EDITABLE_STATUSES: Exclude<OnlineOrderStatus, "invoiced">[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "cancelled",
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatOrderDate(value: string) {
  return new Date(value).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function makeDraft(order: OnlineOrderWithItems): Draft {
  return {
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    notes: order.notes,
    lines: order.items.map((item) => ({
      key: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
    })),
  };
}

function getLineUnitPrice(
  line: DraftLine,
  productMap: Map<string, StaffOnlineProductOption>
) {
  const product = productMap.get(line.productId);
  if (!product) return 0;
  if (!line.variantId) return product.price;
  return product.variants.find((variant) => variant.id === line.variantId)?.price ?? product.price;
}

function orderItemName(item: OnlineOrderWithItems["items"][number]) {
  return item.variant_name ? `${item.product_name} · ${item.variant_name}` : item.product_name;
}

interface OnlineOrdersPageClientProps {
  orders: OnlineOrderWithItems[];
  products: StaffOnlineProductOption[];
  compact?: boolean;
  enabledPaymentMethods?: PaymentMethod[];
  receiptBranding?: ReportBranding | null;
}

export function OnlineOrdersPageClient({
  orders,
  products,
  compact = false,
  enabledPaymentMethods = ["cash", "card", "wallet", "other"],
  receiptBranding = null,
}: OnlineOrdersPageClientProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          لا توجد طلبات أونلاين حتى الآن.
        </CardContent>
      </Card>
    );
  }

  const activeOrders = orders.filter((order) => order.status !== "cancelled" && order.status !== "invoiced");
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const readyOrders = orders.filter((order) => order.status === "ready");

  return (
    <div className={cn("grid", compact ? "gap-2" : "gap-4")} dir="rtl">
      {!compact ? (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">طلبات نشطة</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{activeOrders.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="text-xs opacity-80">تحتاج مراجعة</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pendingOrders.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="text-xs opacity-80">جاهزة</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{readyOrders.length}</p>
        </div>
      </div>
      ) : null}

      {orders.map((order) => (
        <OnlineOrderCard
          key={order.id}
          order={order}
          products={products}
          compact={compact}
          enabledPaymentMethods={enabledPaymentMethods}
          receiptBranding={receiptBranding}
        />
      ))}
    </div>
  );
}

function OnlineOrderCard({
  order,
  products,
  compact,
  enabledPaymentMethods,
  receiptBranding,
}: {
  order: OnlineOrderWithItems;
  products: StaffOnlineProductOption[];
  compact: boolean;
  enabledPaymentMethods: PaymentMethod[];
  receiptBranding: ReportBranding | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => makeDraft(order));
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isLocked = order.status === "cancelled" || order.status === "invoiced";
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const draftTotal = useMemo(
    () =>
      draft.lines.reduce(
        (total, line) => total + getLineUnitPrice(line, productMap) * line.quantity,
        0
      ),
    [draft.lines, productMap]
  );

  function addLine() {
    const product = products[0];
    if (!product) return;
    setDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          key: crypto.randomUUID(),
          productId: product.id,
          variantId: product.variants[0]?.id ?? null,
          quantity: 1,
        },
      ],
    }));
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  }

  function saveDetails() {
    startTransition(async () => {
      try {
        await updateOnlineOrderDetailsAction(order.id, {
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          notes: draft.notes,
          lines: draft.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        toast.success("تم حفظ الطلب");
        setIsEditingItems(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر حفظ الطلب");
      }
    });
  }

  function changeStatus(status: Exclude<OnlineOrderStatus, "invoiced">) {
    startTransition(async () => {
      try {
        await updateOnlineOrderStatusAction(order.id, status);
        toast.success("تم تحديث الحالة");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث الحالة");
      }
    });
  }

  function openPayment() {
    setPaymentOpen(true);
  }

  function completeInvoice(payments: PaymentSplit[]) {
    startTransition(async () => {
      try {
        const result = await invoiceOnlineOrderAction(order.id, payments);
        toast.success(`تم إنشاء الريسيت ${result.order_number}`);
        setPaymentOpen(false);
        if (receiptBranding) {
          setReceipt(
            buildReceiptPayloadFromOnlineOrder({
              order,
              branding: receiptBranding,
              orderNumber: result.order_number,
              payments,
              total: result.total,
            })
          );
          setReceiptOpen(true);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إنشاء الريسيت");
      }
    });
  }

  function viewReceipt() {
    startTransition(async () => {
      try {
        const payload = await getOnlineOrderReceiptPayloadAction(order.id);
        setReceipt(payload);
        setReceiptOpen(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر عرض الريسيت");
      }
    });
  }

  return (
    <>
    <Card className={cn("border-border/70 bg-card/95 shadow-sm", compact ? "gap-2 rounded-2xl py-2" : "rounded-3xl")}>
      <CardHeader
        className={cn(
          "border-b border-border/60 sm:grid-cols-[1fr_auto]",
          compact ? "gap-2 px-3 pb-2" : "gap-4 pb-4"
        )}
      >
        <div className={cn("min-w-0", compact ? "space-y-2" : "space-y-3")}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                "border",
                compact ? "h-6 px-2 text-[11px]" : "h-7 px-3",
                STATUS_STYLES[order.status]
              )}
              variant="outline"
            >
              <CircleDot className="size-3" />
              {STATUS_LABELS[order.status]}
            </Badge>
            <CardTitle className={cn("font-semibold", compact ? "text-sm" : "text-lg")}>
              طلب أونلاين #{order.id.slice(0, 8)}
            </CardTitle>
          </div>
          <div
            className={cn(
              "grid text-muted-foreground sm:grid-cols-2 xl:grid-cols-4",
              compact ? "gap-1 text-xs" : "gap-2 text-sm"
            )}
          >
            <span className={cn("flex items-center gap-2 rounded-xl bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")}>
              <UserRound className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{draft.customerName || "بدون اسم"}</span>
            </span>
            <span className={cn("flex items-center gap-2 rounded-xl bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")} dir="ltr">
              <Phone className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate tabular-nums">{draft.customerPhone || "بدون هاتف"}</span>
            </span>
            <span className={cn("flex items-center gap-2 rounded-xl bg-muted/40", compact ? "hidden px-2 py-1 xl:flex" : "px-3 py-2")}>
              <Store className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{order.storeName}</span>
            </span>
            <span className={cn("flex items-center gap-2 rounded-xl bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")}>
              <CalendarClock className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{formatOrderDate(order.created_at)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          {order.order_id ? (
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              className="rounded-xl"
              disabled={isPending}
              onClick={viewReceipt}
            >
              <FileText className="size-4" />
              عرض الريسيت
            </Button>
          ) : null}
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            className="rounded-xl"
            disabled={isPending || isLocked}
            onClick={openPayment}
          >
            <ReceiptText className="size-4" />
            عمل ريسيت
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "grid",
          compact ? "gap-2 px-3 pt-2 xl:grid-cols-[minmax(0,1fr)_220px]" : "gap-5 pt-4 xl:grid-cols-[minmax(0,1fr)_320px]"
        )}
      >
        <div className={compact ? "space-y-2" : "space-y-5"}>
          <section className={cn("border border-border/70 bg-background/60", compact ? "rounded-xl p-2" : "rounded-2xl p-3")}>
            <div className={cn("flex items-center justify-between gap-3", compact ? "mb-1" : "mb-3")}>
              <h3 className={cn("font-medium", compact && "text-sm")}>ملخص الطلب</h3>
              <Button
                type="button"
                variant="outline"
                size={compact ? "sm" : "default"}
                className="rounded-xl"
                disabled={isLocked}
                onClick={() => setIsEditingItems((open) => !open)}
              >
                {isEditingItems ? "إخفاء التعديل" : "تعديل الأصناف"}
              </Button>
            </div>
            <div className={compact ? "space-y-1" : "space-y-2"}>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl bg-muted/40",
                    compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
                  )}
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.quantity} × {orderItemName(item)}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(item.line_total)}
                  </span>
                </div>
              ))}
              {order.notes ? (
                <p className={cn("rounded-xl bg-muted/50 text-muted-foreground", compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm")}>
                  {order.notes}
                </p>
              ) : null}
            </div>
          </section>

          {isEditingItems ? (
            <>
              <section className={cn("border border-border/70 bg-background/60", compact ? "rounded-xl p-2" : "rounded-2xl p-3")}>
                <div className={cn("flex items-center justify-between gap-3", compact ? "mb-1" : "mb-3")}>
                  <h3 className={cn("font-medium", compact && "text-sm")}>تعديل الأصناف</h3>
                  <span className="text-sm text-muted-foreground">
                    {draft.lines.length} صنف
                  </span>
                </div>
                <div className={compact ? "space-y-1" : "space-y-2"}>
                {draft.lines.map((line) => {
                  const product = productMap.get(line.productId);
                  const variants = product?.variants ?? [];
                  const unitPrice = getLineUnitPrice(line, productMap);
                  return (
                    <div
                      key={line.key}
                      className={cn(
                        "grid bg-muted/40 md:items-center",
                        compact
                          ? "gap-1 rounded-xl p-1 md:grid-cols-[minmax(130px,1.3fr)_minmax(100px,1fr)_64px_78px_30px]"
                          : "gap-2 rounded-2xl p-2 md:grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_88px_110px_auto]"
                      )}
                    >
                  <select
                    value={line.productId}
                    disabled={isLocked}
                    onChange={(event) => {
                      const selected = productMap.get(event.target.value);
                      updateLine(line.key, {
                        productId: event.target.value,
                        variantId: selected?.variants[0]?.id ?? null,
                      });
                    }}
                    className={cn(
                      "rounded-xl border border-input bg-background text-sm",
                      compact ? "h-8 px-2 text-xs" : "h-10 px-3"
                    )}
                  >
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={line.variantId ?? ""}
                    disabled={isLocked || variants.length === 0}
                    onChange={(event) => updateLine(line.key, { variantId: event.target.value || null })}
                    className={cn(
                      "rounded-xl border border-input bg-background text-sm",
                      compact ? "h-8 px-2 text-xs" : "h-10 px-3"
                    )}
                  >
                    <option value="">بدون خيار</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    disabled={isLocked}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })
                    }
                    className={cn("rounded-xl", compact ? "h-8 px-2 text-xs" : "h-10")}
                  />
                  <div className={cn("rounded-xl bg-background font-medium tabular-nums", compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm")}>
                    {formatMoney(unitPrice * line.quantity)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size={compact ? "icon-sm" : "icon"}
                    className="rounded-xl text-muted-foreground hover:text-destructive"
                    disabled={isLocked}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        lines: current.lines.filter((candidate) => candidate.key !== line.key),
                      }))
                    }
                    aria-label="حذف الصنف"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
                })}
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size={compact ? "sm" : "default"} className="rounded-xl" disabled={isLocked || products.length === 0} onClick={addLine}>
                  <Plus className="size-4" />
                  إضافة صنف
                </Button>
                <Button type="button" size={compact ? "sm" : "default"} className="rounded-xl" disabled={isPending || isLocked} onClick={saveDetails}>
                  <Save className="size-4" />
                  حفظ التعديل
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <aside className={cn("border border-border/70 bg-muted/30", compact ? "space-y-2 rounded-xl p-2" : "space-y-4 rounded-2xl p-4")}>
          <div className={cn("bg-card", compact ? "rounded-xl p-2" : "rounded-2xl p-4")}>
            <p className="text-sm text-muted-foreground">الإجمالي</p>
            <p className={cn("mt-1 font-semibold tabular-nums", compact ? "text-lg" : "text-2xl")}>{formatMoney(draftTotal || order.total)}</p>
            {Math.abs(draftTotal - order.total) > 0.01 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                المسجل حاليًا: {formatMoney(order.total)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">تغيير الحالة</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
            {EDITABLE_STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                variant="outline"
                className={cn(
                  "shrink-0 justify-center rounded-xl border",
                  compact ? "h-8 min-w-24 px-2 text-xs" : "h-10 min-w-28 px-3",
                  STATUS_STYLES[status],
                  order.status === status && "ring-2 ring-primary/30"
                )}
                disabled={isPending || order.status === "invoiced" || (order.status === "cancelled" && status !== "cancelled")}
                onClick={() => changeStatus(status)}
              >
                {order.status === status ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Clock3 className="size-4 text-muted-foreground" />
                )}
                {STATUS_LABELS[status]}
              </Button>
            ))}
            </div>
          </div>
        </aside>
      </CardContent>
    </Card>

    <PaymentPanel
      open={paymentOpen}
      onClose={() => setPaymentOpen(false)}
      onComplete={completeInvoice}
      enabledMethods={enabledPaymentMethods}
      customerName={draft.customerName || null}
      loading={isPending}
      fixedTotal={draftTotal || order.total}
    />
    <ReceiptModal
      open={receiptOpen}
      onOpenChange={setReceiptOpen}
      receipt={receipt}
    />
    </>
  );
}
