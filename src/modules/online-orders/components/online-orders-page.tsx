"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  FileText,
  MessageCircle,
  Phone,
  Plus,
  ReceiptText,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { StatusPill } from "@/components/Velora/status-pill";
import { phoneSearchDigits } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  allowedOnlineOrderStatusTransitions,
  canCancelOnlineOrder,
  primaryNextOnlineOrderStatus,
} from "@/modules/online-orders/lib/online-order-status";
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
import {
  buildWhatsAppReceiptUrl,
  normalizeWhatsAppPhone,
} from "@/modules/pos/services/receipt-format.service";
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
import { formatCurrency } from "@/lib/format";

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
  invoiced: "تم الريسيت",
};

const STATUS_PILL: Record<
  OnlineOrderStatus,
  "default" | "warning" | "success" | "danger" | "info"
> = {
  pending: "warning",
  accepted: "info",
  preparing: "default",
  ready: "success",
  cancelled: "danger",
  invoiced: "default",
};

const STATUS_ACCENT: Record<OnlineOrderStatus, string> = {
  pending: "border-s-[var(--mds-color-feedback-warning)]",
  accepted: "border-s-[var(--mds-color-feedback-info)]",
  preparing: "border-s-violet-500",
  ready: "border-s-[var(--mds-color-feedback-success)]",
  cancelled: "border-s-destructive",
  invoiced: "border-s-muted-foreground/40",
};

/** Label for advancing *to* this status (keyed by next status). */
const NEXT_ACTION_LABELS: Record<
  Exclude<OnlineOrderStatus, "invoiced" | "cancelled" | "pending">,
  string
> = {
  accepted: "قبول",
  preparing: "بدء التحضير",
  ready: "جاهز",
};

type BoardFilter = "active" | "pending" | "ready" | "all";

const STATUS_SORT: Record<OnlineOrderStatus, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  invoiced: 4,
  cancelled: 5,
};

function filterOrders(orders: OnlineOrderWithItems[], filter: BoardFilter) {
  switch (filter) {
    case "pending":
      return orders.filter((order) => order.status === "pending");
    case "ready":
      return orders.filter((order) => order.status === "ready");
    case "active":
      return orders.filter(
        (order) => order.status !== "cancelled" && order.status !== "invoiced"
      );
    case "all":
    default:
      return orders;
  }
}

function formatOrderTime(value: string) {
  return new Date(value).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderItemName(item: OnlineOrderWithItems["items"][number]) {
  return item.variant_name ? `${item.product_name} · ${item.variant_name}` : item.product_name;
}

function orderMatchesSearch(order: OnlineOrderWithItems, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const phoneDigits = phoneSearchDigits(q);
  const orderPhoneDigits = phoneSearchDigits(order.customer_phone ?? "");
  if (phoneDigits.length >= 3 && orderPhoneDigits.includes(phoneDigits)) return true;

  const haystack = [
    order.customer_name,
    order.customer_phone ?? "",
    order.notes,
    order.delivery_area ?? "",
    order.delivery_address ?? "",
    order.id,
    order.id.slice(0, 8),
    ...order.items.map((item) => orderItemName(item)),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function customerWhatsAppUrl(phone: string, status: OnlineOrderStatus, customerName: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const greeting = customerName.trim() ? `مرحباً ${customerName.trim()}، ` : "مرحباً، ";
  const body =
    status === "ready"
      ? `${greeting}طلبك جاهز.`
      : status === "preparing"
        ? `${greeting}طلبك قيد التحضير.`
        : `${greeting}بخصوص طلبك.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`;
}

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function makeDraft(order: OnlineOrderWithItems): Draft {
  return {
    customerName: order.customer_name,
    customerPhone: order.customer_phone ?? "",
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

function itemsPreview(items: OnlineOrderWithItems["items"], limit = 3) {
  const names = items.slice(0, limit).map((item) => `${item.quantity}× ${orderItemName(item)}`);
  const extra = items.length - limit;
  if (extra > 0) names.push(`+${extra}`);
  return names.join(" · ");
}

interface OnlineOrdersPageClientProps {
  orders: OnlineOrderWithItems[];
  products: StaffOnlineProductOption[];
  compact?: boolean;
  enabledPaymentMethods?: PaymentMethod[];
  receiptBranding?: ReportBranding | null;
}

export function OnlineOrdersPageClient({
  orders: initialOrders,
  products,
  compact = false,
  enabledPaymentMethods = ["cash", "card", "wallet", "other"],
  receiptBranding = null,
}: OnlineOrdersPageClientProps) {
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("active");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [orders, setOrders] = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const firstPending = initialOrders.find((order) => order.status === "pending");
    return firstPending?.id ?? null;
  });

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  function upsertOrder(next: OnlineOrderWithItems) {
    setOrders((prev) => {
      const idx = prev.findIndex((order) => order.id === next.id);
      if (idx === -1) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  const searchedOrders = useMemo(
    () => orders.filter((order) => orderMatchesSearch(order, deferredSearch)),
    [orders, deferredSearch]
  );
  const visibleOrders = useMemo(
    () =>
      filterOrders(searchedOrders, boardFilter)
        .slice()
        .sort((a, b) => {
          const rank = STATUS_SORT[a.status] - STATUS_SORT[b.status];
          if (rank !== 0) return rank;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [searchedOrders, boardFilter]
  );

  const filters: { id: BoardFilter; label: string; count: number }[] = [
    {
      id: "active",
      label: "نشطة",
      count: searchedOrders.filter((o) => o.status !== "cancelled" && o.status !== "invoiced").length,
    },
    {
      id: "pending",
      label: "معلقة",
      count: searchedOrders.filter((o) => o.status === "pending").length,
    },
    {
      id: "ready",
      label: "جاهزة",
      count: searchedOrders.filter((o) => o.status === "ready").length,
    },
    { id: "all", label: "الكل", count: searchedOrders.length },
  ];

  const hasSearch = search.trim().length > 0;

  if (orders.length === 0) {
    return (
      <EmptyStateBlock
        title="لا توجد طلبات أونلاين"
        description="الطلبات الجديدة من رابط المنيو هتظهر هنا تلقائيًا."
      />
    );
  }

  return (
    <div className={cn("grid", compact ? "gap-2" : "gap-3")} dir="rtl">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو الصنف…"
          aria-label="بحث طلبات الأونلاين"
          className={cn(
            "rounded-[var(--mds-radius-md)] ps-10 pe-10",
            compact ? "h-9 text-sm" : "h-11 md:h-10"
          )}
        />
        {hasSearch ? (
          <button
            type="button"
            className="absolute end-1.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="مسح البحث"
            onClick={() => setSearch("")}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-1.5 rounded-[var(--mds-radius-md)] bg-muted/60 p-1"
        role="tablist"
        aria-label="تصفية الطلبات"
      >
        {filters.map((filter) => {
          const active = boardFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--mds-radius-sm)] px-3 text-sm font-medium transition-colors sm:min-h-9 sm:flex-none",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setBoardFilter(filter.id)}
            >
              {filter.label}
              <span
                className={cn(
                  "tabular-nums text-xs",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {filter.count}
              </span>
            </button>
          );
        })}
      </div>

      {hasSearch ? (
        <p className="text-xs text-muted-foreground">
          {visibleOrders.length === 0
            ? "لا نتائج"
            : `${visibleOrders.length} نتيجة`}
          {deferredSearch.trim() ? ` · «${deferredSearch.trim()}»` : null}
        </p>
      ) : null}

      {visibleOrders.length === 0 ? (
        <EmptyStateBlock
          title={hasSearch ? "لا نتائج لهذا البحث" : "لا توجد طلبات في هذا الفلتر"}
          description={
            hasSearch
              ? "جرّب اسم العميل أو جزء من رقم الهاتف أو اسم صنف."
              : undefined
          }
          action={
            hasSearch ? (
              <Button type="button" variant="outline" onClick={() => setSearch("")}>
                مسح البحث
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className={cn("grid", compact ? "gap-2" : "gap-2.5")}>
          {visibleOrders.map((order) => (
            <li key={order.id}>
              <OnlineOrderCard
                order={order}
                products={products}
                compact={compact}
                expanded={expandedId === order.id}
                onToggleExpand={() =>
                  setExpandedId((current) => (current === order.id ? null : order.id))
                }
                enabledPaymentMethods={enabledPaymentMethods}
                receiptBranding={receiptBranding}
                onOrderChange={upsertOrder}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OnlineOrderCard({
  order,
  products,
  compact,
  expanded,
  onToggleExpand,
  enabledPaymentMethods,
  receiptBranding,
  onOrderChange,
}: {
  order: OnlineOrderWithItems;
  products: StaffOnlineProductOption[];
  compact: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  enabledPaymentMethods: PaymentMethod[];
  receiptBranding: ReportBranding | null;
  onOrderChange: (order: OnlineOrderWithItems) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => makeDraft(order));
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [invoicePending, startInvoice] = useTransition();
  const [receiptPending, startReceipt] = useTransition();
  const router = useRouter();
  const statusSnapshotRef = useRef<OnlineOrderWithItems | null>(null);
  const detailsSnapshotRef = useRef<OnlineOrderWithItems | null>(null);
  const isLocked = order.status === "cancelled" || order.status === "invoiced";
  const nextStatus = primaryNextOnlineOrderStatus(order.status);
  const transitionTargets = allowedOnlineOrderStatusTransitions(order.status).filter(
    (status) => status !== "cancelled"
  );
  const canCancel = canCancelOnlineOrder(order.status);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const draftTotal = useMemo(
    () =>
      draft.lines.reduce(
        (total, line) => total + getLineUnitPrice(line, productMap) * line.quantity,
        0
      ),
    [draft.lines, productMap]
  );

  useEffect(() => {
    setDraft(makeDraft(order));
  }, [order]);

  useEffect(() => {
    if (!expanded) setIsEditingItems(false);
  }, [expanded]);

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
    detailsSnapshotRef.current = order;
    setIsEditingItems(false);

    void (async () => {
      try {
        const updated = await updateOnlineOrderDetailsAction(order.id, {
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          notes: draft.notes,
          lines: draft.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        onOrderChange(updated);
        toast.success("تم حفظ الطلب");
      } catch (error) {
        if (detailsSnapshotRef.current) onOrderChange(detailsSnapshotRef.current);
        setIsEditingItems(true);
        toast.error(error instanceof Error ? error.message : "تعذر حفظ الطلب");
      }
    })();
  }

  function changeStatus(status: Exclude<OnlineOrderStatus, "invoiced">) {
    statusSnapshotRef.current = order;
    onOrderChange({ ...order, status });

    void (async () => {
      try {
        const updated = await updateOnlineOrderStatusAction(order.id, status);
        onOrderChange(updated);
      } catch (error) {
        if (statusSnapshotRef.current) onOrderChange(statusSnapshotRef.current);
        toast.error(error instanceof Error ? error.message : "تعذر تحديث الحالة");
      }
    })();
  }

  function openPayment() {
    setPaymentOpen(true);
  }

  function completeInvoice(payments: PaymentSplit[]) {
    startInvoice(async () => {
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
    startReceipt(async () => {
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

  const fulfillmentLabel =
    order.fulfillment_type === "delivery"
      ? "توصيل"
      : order.fulfillment_type === "pickup"
        ? "استلام"
        : null;

  const nextActionLabel =
    nextStatus && nextStatus in NEXT_ACTION_LABELS
      ? NEXT_ACTION_LABELS[nextStatus as keyof typeof NEXT_ACTION_LABELS]
      : nextStatus
        ? STATUS_LABELS[nextStatus]
        : null;

  const callHref = draft.customerPhone ? telHref(draft.customerPhone) : null;
  const whatsappHref = draft.customerPhone
    ? customerWhatsAppUrl(draft.customerPhone, order.status, draft.customerName)
    : null;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <article
        className={cn(
          "rounded-[var(--mds-radius-lg)] border border-border border-s-4 bg-card shadow-[var(--mds-elevation-1)]",
          STATUS_ACCENT[order.status],
          compact ? "p-2.5" : "p-3.5"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusPill
              label={STATUS_LABELS[order.status]}
              variant={STATUS_PILL[order.status]}
            />
            {fulfillmentLabel ? (
              <span className="rounded-[var(--mds-radius-pill)] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {fulfillmentLabel}
                {order.fulfillment_type === "delivery" && order.delivery_area
                  ? ` · ${order.delivery_area}`
                  : ""}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground tabular-nums">
              {itemCount} قطعة
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={order.created_at}>{formatOrderTime(order.created_at)}</time>
            <span className="tabular-nums opacity-70" dir="ltr">
              #{order.id.slice(0, 8)}
            </span>
          </div>
        </div>

        <div className={cn("mt-2 flex flex-wrap items-start justify-between gap-2", compact ? "gap-1.5" : "gap-3")}>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
              {draft.customerName || "بدون اسم"}
            </p>
            {draft.customerPhone ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                {callHref ? (
                  <a
                    href={callHref}
                    className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-[var(--mds-radius-md)] bg-muted/50 px-2 py-1 text-sm text-foreground transition-colors hover:bg-muted"
                    dir="ltr"
                    aria-label={`اتصال بـ ${draft.customerName || draft.customerPhone}`}
                  >
                    <Phone className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate tabular-nums">{draft.customerPhone}</span>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                    {draft.customerPhone}
                  </span>
                )}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-8 items-center justify-center rounded-[var(--mds-radius-md)] text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
                    aria-label="مراسلة واتساب"
                  >
                    <MessageCircle className="size-4" />
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">بدون هاتف</p>
            )}
          </div>
          <p className={cn("shrink-0 font-semibold tabular-nums", compact ? "text-base" : "text-lg")}>
            {formatCurrency(order.total)}
          </p>
        </div>

        <p className={cn("mt-2 text-muted-foreground", compact ? "text-xs line-clamp-2" : "text-sm line-clamp-2")}>
          {itemsPreview(order.items, compact ? 2 : 3)}
        </p>

        {order.notes && !expanded ? (
          <p className="mt-1.5 truncate text-xs text-amber-700 dark:text-amber-300">
            ملاحظة: {order.notes}
          </p>
        ) : null}

        <div className={cn("mt-3 flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
          {!isLocked && nextStatus ? (
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              className="min-h-10 rounded-[var(--mds-radius-md)]"
              onClick={() => changeStatus(nextStatus)}
            >
              {nextActionLabel ?? STATUS_LABELS[nextStatus]}
            </Button>
          ) : null}
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            variant={order.status === "ready" ? "default" : "outline"}
            className="min-h-10 size-10 shrink-0 rounded-[var(--mds-radius-md)] px-0 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5"
            disabled={invoicePending || isLocked}
            onClick={openPayment}
            aria-label="ريسيت"
          >
            <ReceiptText className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">ريسيت</span>
          </Button>
          {order.order_id ? (
            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              className="min-h-10 size-10 shrink-0 rounded-[var(--mds-radius-md)] px-0 sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5"
              disabled={receiptPending}
              onClick={viewReceipt}
              aria-label="الريسيت"
            >
              <FileText className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">الريسيت</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size={compact ? "sm" : "default"}
            className="min-h-10 size-10 shrink-0 rounded-[var(--mds-radius-md)] px-0 text-muted-foreground sm:h-auto sm:w-auto sm:px-3 sm:gap-1.5"
            aria-expanded={expanded}
            aria-label={expanded ? "إخفاء" : "تفاصيل"}
            onClick={onToggleExpand}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
            <span className="sr-only sm:not-sr-only">{expanded ? "إخفاء" : "تفاصيل"}</span>
          </Button>
        </div>

        {expanded ? (
          <div className={cn("mt-3 border-t border-border/70 pt-3", compact ? "space-y-2" : "space-y-3")}>
            {order.fulfillment_type === "delivery" && order.delivery_address ? (
              <p className="text-sm text-muted-foreground">
                العنوان: <span className="text-foreground">{order.delivery_address}</span>
                {order.delivery_fee > 0 ? (
                  <span className="ms-2 tabular-nums">
                    (توصيل {formatCurrency(order.delivery_fee)})
                  </span>
                ) : null}
              </p>
            ) : null}

            <ul className="space-y-1.5">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.quantity} × {orderItemName(item)}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            {order.notes ? (
              <p className="rounded-[var(--mds-radius-md)] bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                {order.notes}
              </p>
            ) : null}

            {order.delivery_fee > 0 ? (
              <p className="text-xs text-muted-foreground">
                أصناف {formatCurrency(order.subtotal)} + توصيل {formatCurrency(order.delivery_fee)}
                — فاتورة الكاشير للأصناف فقط.
              </p>
            ) : null}

            {!isLocked ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-[var(--mds-radius-md)]"
                  onClick={() => setIsEditingItems((open) => !open)}
                >
                  {isEditingItems ? "إخفاء التعديل" : "تعديل الطلب"}
                </Button>
                {transitionTargets
                  .filter((status) => status !== nextStatus)
                  .map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-[var(--mds-radius-md)]"
                      onClick={() => changeStatus(status)}
                    >
                      {STATUS_LABELS[status]}
                    </Button>
                  ))}
                {canCancel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[var(--mds-radius-md)] border-destructive/30 text-destructive"
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    <XCircle className="size-4" />
                    إلغاء
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {order.status === "cancelled"
                  ? "الطلب ملغي — لا يمكن تغيير حالته."
                  : "الطلب مُفوتر — الحالة مقفلة."}
              </p>
            )}

            {isEditingItems ? (
              <div className={cn("space-y-3 rounded-[var(--mds-radius-md)] border border-border bg-muted/20", compact ? "p-2" : "p-3")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={draft.customerName}
                    disabled={isLocked}
                    placeholder="اسم العميل"
                    aria-label="اسم العميل"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, customerName: event.target.value }))
                    }
                    className={cn("rounded-[var(--mds-radius-md)]", compact ? "h-8 text-xs" : "h-10")}
                  />
                  <Input
                    value={draft.customerPhone}
                    disabled={isLocked}
                    placeholder="رقم الهاتف (اختياري)"
                    aria-label="رقم الهاتف"
                    dir="ltr"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, customerPhone: event.target.value }))
                    }
                    className={cn("rounded-[var(--mds-radius-md)]", compact ? "h-8 text-xs" : "h-10")}
                  />
                  <Input
                    value={draft.notes}
                    disabled={isLocked}
                    placeholder="ملاحظات"
                    aria-label="ملاحظات"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={cn("rounded-[var(--mds-radius-md)] sm:col-span-2", compact ? "h-8 text-xs" : "h-10")}
                  />
                </div>

                <div className="space-y-1.5">
                  {draft.lines.map((line) => {
                    const product = productMap.get(line.productId);
                    const variants = product?.variants ?? [];
                    const unitPrice = getLineUnitPrice(line, productMap);
                    return (
                      <div
                        key={line.key}
                        className={cn(
                          "grid grid-cols-1 gap-1.5 rounded-[var(--mds-radius-md)] bg-background/80 p-1.5 sm:grid-cols-2 md:items-center",
                          compact
                            ? "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_5rem_auto]"
                            : "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_6.5rem_auto]"
                        )}
                      >
                        <select
                          value={line.productId}
                          disabled={isLocked}
                          aria-label="المنتج"
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
                          aria-label="الخيار"
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
                          aria-label="الكمية"
                          onChange={(event) =>
                            updateLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                          className={cn("rounded-[var(--mds-radius-md)]", compact ? "h-8 px-2 text-xs" : "h-10")}
                        />
                        <div className={cn("rounded-[var(--mds-radius-md)] bg-muted/40 font-medium tabular-nums", compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm")}>
                          {formatCurrency(unitPrice * line.quantity)}
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

                {Math.abs(draftTotal - order.subtotal) > 0.01 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    مسودة الأصناف: {formatCurrency(draftTotal)} (لم تُحفظ بعد)
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[var(--mds-radius-md)]"
                    disabled={isLocked || products.length === 0}
                    onClick={addLine}
                  >
                    <Plus className="size-4" />
                    إضافة صنف
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-[var(--mds-radius-md)]"
                    disabled={isLocked}
                    onClick={saveDetails}
                  >
                    <Save className="size-4" />
                    حفظ
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      <ConfirmActionDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="إلغاء هذا الطلب؟"
        description="سيتم تحرير أي حجز مخزون مرتبط، ولا يمكن إعادة فتح الطلب الملغي."
        confirmLabel="تأكيد الإلغاء"
        destructive
        onConfirm={async () => {
          setCancelConfirmOpen(false);
          changeStatus("cancelled");
        }}
      />

      <PaymentPanel
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onComplete={completeInvoice}
        enabledMethods={enabledPaymentMethods}
        customerName={draft.customerName || null}
        loading={invoicePending}
        fixedTotal={draftTotal || order.subtotal}
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
