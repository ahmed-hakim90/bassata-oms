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
import { PosReceiptSuccessDialog } from "@/modules/pos/components/pos-receipt-success-dialog";
import {
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { buildWhatsAppReceiptUrl } from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { buildReceiptPayloadFromOnlineOrder } from "@/modules/pos/utils/receipt-payload";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
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
      <Card className="rounded-[var(--mds-radius-lg)] border-border shadow-[var(--mds-elevation-1)]">
        <CardContent className="py-[var(--mds-space-8)] text-center text-muted-foreground">
          لا توجد طلبات أونلاين حتى الآن.
        </CardContent>
      </Card>
    );
  }

  const activeOrders = orders.filter((order) => order.status !== "cancelled" && order.status !== "invoiced");
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const readyOrders = orders.filter((order) => order.status === "ready");

  return (
    <div className={cn("grid", compact ? "gap-[var(--mds-space-2)]" : "gap-[var(--mds-space-4)]")} dir="rtl">
      {!compact ? (
      <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-3">
        <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
          <p className="text-xs text-muted-foreground">طلبات نشطة</p>
          <p className="mt-[var(--mds-space-1)] text-2xl font-semibold tabular-nums">{activeOrders.length}</p>
        </div>
        <div className="rounded-[var(--mds-radius-lg)] border border-[var(--mds-color-feedback-warning)]/30 bg-[var(--mds-color-feedback-warning)]/10 p-[var(--mds-space-4)] text-[var(--mds-color-feedback-warning)] shadow-[var(--mds-elevation-1)]">
          <p className="text-xs opacity-80">تحتاج مراجعة</p>
          <p className="mt-[var(--mds-space-1)] text-2xl font-semibold tabular-nums">{pendingOrders.length}</p>
        </div>
        <div className="rounded-[var(--mds-radius-lg)] border border-[var(--mds-color-feedback-success)]/30 bg-[var(--mds-color-feedback-success)]/10 p-[var(--mds-space-4)] text-[var(--mds-color-feedback-success)] shadow-[var(--mds-elevation-1)]">
          <p className="text-xs opacity-80">جاهزة</p>
          <p className="mt-[var(--mds-space-1)] text-2xl font-semibold tabular-nums">{readyOrders.length}</p>
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
        playPosSuccessSound();
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
        playPosErrorSound();
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

  async function handleUsbPrintReceipt() {
    if (!receipt) return;
    try {
      await printReceiptViaUsb(receipt);
      toast.success("تم إرسال الإيصال لطابعة USB");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  function handleBrowserPrintReceipt() {
    if (!receipt) return;
    setTimeout(() => triggerReceiptPrint(), 50);
  }

  function handleSendWhatsAppReceipt() {
    if (!receipt) return;
    const url = buildWhatsAppReceiptUrl(receipt);
    if (!url) {
      toast.error("رقم هاتف العميل غير صالح لواتساب");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
    <Card className={cn("border-border bg-card shadow-[var(--mds-elevation-1)]", compact ? "gap-[var(--mds-space-2)] rounded-[var(--mds-radius-lg)] py-[var(--mds-space-2)]" : "rounded-[var(--mds-radius-lg)]")}>
      <CardHeader
        className={cn(
          "border-b border-border sm:grid-cols-[1fr_auto]",
          compact ? "gap-[var(--mds-space-2)] px-[var(--mds-space-3)] pb-[var(--mds-space-2)]" : "gap-[var(--mds-space-4)] pb-[var(--mds-space-4)]"
        )}
      >
        <div className={cn("min-w-0", compact ? "space-y-[var(--mds-space-2)]" : "space-y-[var(--mds-space-3)]")}>
          <div className="flex flex-wrap items-center gap-[var(--mds-space-2)]">
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
              compact ? "gap-[var(--mds-space-1)] text-xs" : "gap-[var(--mds-space-2)] text-sm"
            )}
          >
            <span className={cn("flex items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")}>
              <UserRound className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{draft.customerName || "بدون اسم"}</span>
            </span>
            <span className={cn("flex items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")} dir="ltr">
              <Phone className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate tabular-nums">{draft.customerPhone || "بدون هاتف"}</span>
            </span>
            <span className={cn("flex items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] bg-muted/40", compact ? "hidden px-2 py-1 xl:flex" : "px-3 py-2")}>
              <Store className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{order.storeName}</span>
            </span>
            <span className={cn("flex items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] bg-muted/40", compact ? "px-2 py-1" : "px-3 py-2")}>
              <CalendarClock className={cn("text-primary", compact ? "size-3.5" : "size-4")} />
              <span className="truncate">{formatOrderDate(order.created_at)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-[var(--mds-space-2)] sm:justify-end">
          {order.order_id ? (
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              className="rounded-[var(--mds-radius-md)]"
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
            className="rounded-[var(--mds-radius-md)] shadow-[var(--mds-elevation-1)]"
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
          compact ? "gap-[var(--mds-space-2)] px-[var(--mds-space-3)] pt-[var(--mds-space-2)] xl:grid-cols-[minmax(0,1fr)_220px]" : "gap-[var(--mds-space-5)] pt-[var(--mds-space-4)] xl:grid-cols-[minmax(0,1fr)_320px]"
        )}
      >
        <div className={compact ? "space-y-[var(--mds-space-2)]" : "space-y-[var(--mds-space-5)]"}>
          <section className={cn("border border-border bg-background/60", compact ? "rounded-[var(--mds-radius-md)] p-[var(--mds-space-2)]" : "rounded-[var(--mds-radius-lg)] p-[var(--mds-space-3)]")}>
            <div className={cn("flex items-center justify-between gap-[var(--mds-space-3)]", compact ? "mb-[var(--mds-space-1)]" : "mb-[var(--mds-space-3)]")}>
              <h3 className={cn("font-medium", compact && "text-sm")}>ملخص الطلب</h3>
              <Button
                type="button"
                variant="outline"
                size={compact ? "sm" : "default"}
                className="rounded-[var(--mds-radius-md)]"
                disabled={isLocked}
                onClick={() => setIsEditingItems((open) => !open)}
              >
                {isEditingItems ? "إخفاء التعديل" : "تعديل الأصناف"}
              </Button>
            </div>
            <div className={compact ? "space-y-[var(--mds-space-1)]" : "space-y-[var(--mds-space-2)]"}>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-[var(--mds-space-3)] rounded-[var(--mds-radius-md)] bg-muted/40",
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
                <p className={cn("rounded-[var(--mds-radius-md)] bg-muted/50 text-muted-foreground", compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm")}>
                  {order.notes}
                </p>
              ) : null}
            </div>
          </section>

          {isEditingItems ? (
            <>
              <section className={cn("border border-border bg-background/60", compact ? "rounded-[var(--mds-radius-md)] p-[var(--mds-space-2)]" : "rounded-[var(--mds-radius-lg)] p-[var(--mds-space-3)]")}>
                <div className={cn("flex items-center justify-between gap-[var(--mds-space-3)]", compact ? "mb-[var(--mds-space-1)]" : "mb-[var(--mds-space-3)]")}>
                  <h3 className={cn("font-medium", compact && "text-sm")}>تعديل الأصناف</h3>
                  <span className="text-sm text-muted-foreground">
                    {draft.lines.length} صنف
                  </span>
                </div>
                <div className={compact ? "space-y-[var(--mds-space-1)]" : "space-y-[var(--mds-space-2)]"}>
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
                          ? "gap-[var(--mds-space-1)] rounded-[var(--mds-radius-md)] p-1 md:grid-cols-[minmax(130px,1.3fr)_minmax(100px,1fr)_64px_78px_30px]"
                          : "gap-[var(--mds-space-2)] rounded-[var(--mds-radius-lg)] p-[var(--mds-space-2)] md:grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_88px_110px_auto]"
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
                      "rounded-[var(--mds-radius-md)] border border-input bg-background text-sm",
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
                      "rounded-[var(--mds-radius-md)] border border-input bg-background text-sm",
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
                    className={cn("rounded-[var(--mds-radius-md)]", compact ? "h-8 px-2 text-xs" : "h-10")}
                  />
                  <div className={cn("rounded-[var(--mds-radius-md)] bg-background font-medium tabular-nums", compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm")}>
                    {formatMoney(unitPrice * line.quantity)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size={compact ? "icon-sm" : "icon"}
                    className="rounded-[var(--mds-radius-md)] text-muted-foreground hover:text-destructive"
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

              <div className="flex flex-wrap gap-[var(--mds-space-2)]">
                <Button type="button" variant="outline" size={compact ? "sm" : "default"} className="rounded-[var(--mds-radius-md)]" disabled={isLocked || products.length === 0} onClick={addLine}>
                  <Plus className="size-4" />
                  إضافة صنف
                </Button>
                <Button type="button" size={compact ? "sm" : "default"} className="rounded-[var(--mds-radius-md)] shadow-[var(--mds-elevation-1)]" disabled={isPending || isLocked} onClick={saveDetails}>
                  <Save className="size-4" />
                  حفظ التعديل
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <aside className={cn("border border-border bg-muted/30", compact ? "space-y-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] p-[var(--mds-space-2)]" : "space-y-[var(--mds-space-4)] rounded-[var(--mds-radius-lg)] p-[var(--mds-space-4)]")}>
          <div className={cn("bg-card shadow-[var(--mds-elevation-1)]", compact ? "rounded-[var(--mds-radius-md)] p-[var(--mds-space-2)]" : "rounded-[var(--mds-radius-lg)] p-[var(--mds-space-4)]")}>
            <p className="text-sm text-muted-foreground">الإجمالي</p>
            <p className={cn("mt-[var(--mds-space-1)] font-semibold tabular-nums", compact ? "text-lg" : "text-2xl")}>{formatMoney(draftTotal || order.total)}</p>
            {Math.abs(draftTotal - order.total) > 0.01 ? (
              <p className="mt-[var(--mds-space-1)] text-xs text-muted-foreground">
                المسجل حاليًا: {formatMoney(order.total)}
              </p>
            ) : null}
          </div>

          <div className="space-y-[var(--mds-space-2)]">
            <p className="text-sm font-medium">تغيير الحالة</p>
            <div className="flex gap-[var(--mds-space-2)] overflow-x-auto pb-1">
            {EDITABLE_STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                variant="outline"
                className={cn(
                  "shrink-0 justify-center rounded-[var(--mds-radius-md)] border",
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
      creditCustomerLinked={Boolean(draft.customerPhone?.trim())}
    />
    <PosReceiptSuccessDialog
      open={receiptOpen && Boolean(receipt)}
      receipt={receipt}
      onOpenChange={(open) => {
        setReceiptOpen(open);
        if (!open) setReceipt(null);
      }}
      onUsbPrint={handleUsbPrintReceipt}
      onBrowserPrint={handleBrowserPrintReceipt}
      onWhatsApp={handleSendWhatsAppReceipt}
    />
    </>
  );
}
