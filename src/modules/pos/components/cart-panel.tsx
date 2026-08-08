"use client";

import { useState } from "react";
import {
  Banknote,
  CreditCard,
  Minus,
  Pause,
  Percent,
  Plus,
  Star,
  Trash2,
  UserCircle,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { computePosCartTotals } from "@/modules/pos/lib/cart-totals";
import { getCartSubtotal, usePosStore } from "@/stores/pos-store";
import { CustomerAttach } from "@/modules/pos/components/customer-attach";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { playPosErrorSound } from "@/modules/pos/lib/pos-sounds";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import { holdCartAction } from "@/modules/pos/actions/held-cart.actions";

const METHOD_META: Record<
  PaymentMethod,
  {
    label: string;
    icon: typeof Banknote;
    className: string;
  }
> = {
  cash: {
    label: "نقدي",
    icon: Banknote,
    className:
      "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  },
  card: {
    label: "كارت",
    icon: CreditCard,
    className:
      "border-sky-300 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-400/40 dark:bg-sky-600 dark:hover:bg-sky-500",
  },
  wallet: {
    label: "محفظة",
    icon: Wallet,
    className:
      "border-violet-300 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-400/40 dark:bg-violet-600 dark:hover:bg-violet-500",
  },
  other: {
    label: "أخرى",
    icon: Banknote,
    className:
      "border-slate-300 bg-slate-700 text-white hover:bg-slate-800 dark:border-slate-400/40 dark:bg-slate-600 dark:hover:bg-slate-500",
  },
  credit: {
    label: "آجل",
    icon: UserCircle,
    className:
      "border-amber-300 bg-amber-500 text-amber-950 hover:bg-amber-400 dark:border-amber-400/40 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400",
  },
};

const METHOD_ORDER: PaymentMethod[] = ["cash", "card", "wallet", "other", "credit"];

interface CartPanelProps {
  onCheckout: (method?: PaymentMethod) => void;
  checkoutDisabled?: boolean;
  checkoutBlockedReason?: string | null;
  discountsEnabled?: boolean;
  promoCartDiscount?: number;
  promoItemSavings?: number;
  promoAdjustedSubtotal?: number | null;
  promoLabels?: string[];
  loyaltyEnabled?: boolean;
  enabledPaymentMethods?: PaymentMethod[];
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
  attachExpanded?: boolean;
  onAttachExpandedChange?: (open: boolean) => void;
  discountOpen?: boolean;
  onDiscountOpenChange?: (open: boolean) => void;
}

export function CartPanel({
  onCheckout,
  checkoutDisabled,
  checkoutBlockedReason = null,
  discountsEnabled = false,
  promoCartDiscount = 0,
  promoItemSavings = 0,
  promoAdjustedSubtotal = null,
  promoLabels = [],
  loyaltyEnabled = false,
  enabledPaymentMethods = ["cash", "card", "wallet", "other"],
  loyaltyRedemptionRate = null,
  minimumLoyaltyRedeemPoints = 0,
  attachExpanded: attachExpandedProp,
  onAttachExpandedChange,
  discountOpen: discountOpenProp,
  onDiscountOpenChange,
}: CartPanelProps) {
  const { t } = useTranslation();
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const setDiscountAmount = usePosStore((s) => s.setDiscountAmount);
  const setLoyaltyRedemption = usePosStore((s) => s.setLoyaltyRedemption);
  const holdCartLocal = usePosStore((s) => s.holdCart);
  const reconcileHeldCartId = usePosStore((s) => s.reconcileHeldCartId);
  const [attachExpandedInternal, setAttachExpandedInternal] = useState(false);
  const [discountOpenInternal, setDiscountOpenInternal] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const attachControlled = attachExpandedProp !== undefined;
  const discountControlled = discountOpenProp !== undefined;
  const attachExpanded = attachControlled ? Boolean(attachExpandedProp) : attachExpandedInternal;
  const discountOpen = discountControlled ? Boolean(discountOpenProp) : discountOpenInternal;

  function setAttachExpanded(next: boolean) {
    if (!attachControlled) setAttachExpandedInternal(next);
    onAttachExpandedChange?.(next);
  }

  function setDiscountOpen(next: boolean) {
    if (!discountControlled) setDiscountOpenInternal(next);
    onDiscountOpenChange?.(next);
  }

  // Single definitions — promo-adjusted subtotal when available, else cart sum.
  const redemptionAmount = loyaltyRedemption?.amount ?? 0;
  const cartSubtotal = getCartSubtotal(cart);
  const totals = computePosCartTotals({
    cart,
    discountAmount,
    loyaltyAmount: redemptionAmount,
    promoPreview:
      promoAdjustedSubtotal != null
        ? {
            lines: [],
            subtotal: promoAdjustedSubtotal,
            cart_discount: promoCartDiscount,
            cart_rule_id: null,
            applications: [],
          }
        : null,
  });
  const subtotal = totals.promoAdjustedSubtotal;
  const totalBeforeRedemption = totals.payableBeforeLoyalty;
  const total = totals.payableTotal;
  const loyaltyAvailable =
    loyaltyEnabled &&
    Boolean(customer) &&
    loyaltyRedemptionRate !== null &&
    loyaltyRedemptionRate > 0 &&
    (loyaltyBalance ?? 0) > 0 &&
    totalBeforeRedemption > 0;
  const maxRedeemablePoints = loyaltyAvailable
    ? Math.min(loyaltyBalance ?? 0, Math.floor(totalBeforeRedemption / loyaltyRedemptionRate))
    : 0;
  const hasMinimumRedeemPoints =
    !loyaltyAvailable ||
    minimumLoyaltyRedeemPoints <= 0 ||
    maxRedeemablePoints >= minimumLoyaltyRedeemPoints;
  const maxRedeemableAmount =
    Math.round(maxRedeemablePoints * (loyaltyRedemptionRate ?? 0) * 100) / 100;
  const canRedeemLoyalty =
    loyaltyAvailable && hasMinimumRedeemPoints && maxRedeemablePoints > 0;

  function applyRedemption(points: number) {
    if (loyaltyRedemptionRate === null || loyaltyRedemptionRate <= 0) {
      setLoyaltyRedemption(null);
      return;
    }
    const safePoints = Math.max(0, Math.min(Math.floor(points), maxRedeemablePoints));
    if (safePoints <= 0 || safePoints < minimumLoyaltyRedeemPoints) {
      setLoyaltyRedemption(null);
      return;
    }
    const amount = Math.round(safePoints * loyaltyRedemptionRate * 100) / 100;
    setLoyaltyRedemption({ points: safePoints, amount });
  }

  const methods = METHOD_ORDER.filter((method) => enabledPaymentMethods.includes(method));
  const payDisabled = cart.length === 0 || checkoutDisabled;
  const hasCart = cart.length > 0;
  const hasPriceReduction =
    discountAmount > 0 ||
    redemptionAmount > 0 ||
    promoCartDiscount > 0 ||
    promoItemSavings > 0;
  const totalSavings = Math.round(
    (promoItemSavings + promoCartDiscount + discountAmount + redemptionAmount) * 100
  ) / 100;
  const uniquePromoLabels = [...new Set(promoLabels.filter(Boolean))];

  function handlePay(method: PaymentMethod) {
    if (payDisabled) return;
    if (method === "credit" && !customer) {
      playPosErrorSound();
      toast.error("اربط عميلًا أولًا للبيع الآجل");
      setAttachExpanded(true);
      return;
    }
    onCheckout(method);
  }

  function handleHoldCart() {
    if (!hasCart) return;
    const state = usePosStore.getState();
    const snapshot = {
      cart: [...state.cart],
      customer: state.customer,
      customerLoyaltyBalance: state.customerLoyaltyBalance,
      loyaltyRedemption: state.loyaltyRedemption,
      discountAmount: state.discountAmount,
      couponCode: state.couponCode,
      salesMode: state.salesMode,
      paymentMethod: state.paymentMethod,
      paymentSplits: [...state.paymentSplits],
      heldCarts: [...state.heldCarts],
    };
    const payload = {
      name: state.customer?.name,
      cart: snapshot.cart,
      customer: snapshot.customer,
      discountAmount: snapshot.discountAmount,
      couponCode: snapshot.couponCode,
      salesMode: snapshot.salesMode,
    };
    const localHeld = holdCartLocal(payload.name);
    if (!localHeld) return;
    toast.success("تم تعليق الفاتورة");

    void holdCartAction(payload).then((result) => {
      if (!result.success) {
        usePosStore.setState(snapshot);
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      reconcileHeldCartId(localHeld.id, result.heldCart);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-card text-card-foreground shadow-none ring-0 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-border">
      <CustomerAttach
        loyaltyEnabled={loyaltyEnabled}
        expanded={attachExpanded}
        onExpandedChange={setAttachExpanded}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 max-[390px]:px-1.5 [-webkit-overflow-scrolling:touch]">
        {!hasCart ? (
          <EmptyStateBlock
            title="السلة فاضية"
            description="اضغط على المنتجات لإضافة أصناف"
            className="mx-2 my-6 border-border/60 bg-transparent p-4 py-8 max-[390px]:my-3 max-[390px]:py-6"
          />
        ) : (
          <ul className="space-y-1.5 py-2 max-[390px]:space-y-1 max-[390px]:py-1.5">
            {cart.map((line) => (
              <li
                key={line.id}
                className="rounded-xl bg-muted/40 px-3 py-2.5 ring-1 ring-border/40 max-[390px]:rounded-lg max-[390px]:px-2.5 max-[390px]:py-2 lg:flex lg:items-start lg:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 lg:block">
                    <p className="text-sm font-medium leading-snug lg:truncate lg:text-base">
                      {line.name}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums lg:hidden">
                      {formatCurrency(line.lineTotal)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatCurrency(line.unitPrice)} {line.saleUnit ? `/${line.saleUnit}` : t("each")}
                    {line.saleInputMode === "by_amount" && line.enteredAmount != null
                      ? ` · بالمبلغ ${formatCurrency(line.enteredAmount)}`
                      : null}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 lg:mt-0 lg:flex-col lg:items-end lg:gap-1">
                  <div className="flex items-center gap-1 lg:gap-1.5">
                    {line.saleInputMode ? (
                      <span className="px-2 text-sm font-medium tabular-nums">
                        {line.saleUnit === "kg"
                          ? `${line.quantity.toFixed(3)} كجم`
                          : line.quantity}
                      </span>
                    ) : (
                      <>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-11 rounded-xl lg:size-11"
                      aria-label="تقليل الكمية"
                      onClick={() => updateQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-base font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-11 rounded-xl lg:size-11"
                      aria-label="زيادة الكمية"
                      onClick={() => updateQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-11 rounded-xl lg:size-11"
                      aria-label="حذف الصنف"
                      onClick={() => removeItem(line.id)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="hidden text-base font-semibold tabular-nums lg:block">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border/60 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-[390px]:p-2 max-[390px]:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          className={cn(
            "mb-2 overflow-hidden rounded-2xl border px-3.5 py-2.5 max-[390px]:mb-1.5 max-[390px]:rounded-xl max-[390px]:px-3 max-[390px]:py-2",
            hasPriceReduction
              ? "border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-card dark:border-emerald-400/25 dark:from-emerald-500/10"
              : "border-border/50 bg-muted/30"
          )}
        >
          {hasPriceReduction ? (
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white dark:bg-emerald-500">
                وفّرت {formatCurrency(totalSavings)}
              </span>
              {uniquePromoLabels.slice(0, 2).map((label) => (
                <span
                  key={label}
                  className="inline-flex max-w-[9.5rem] truncate rounded-full border border-emerald-200/80 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {hasPriceReduction ? "المبلغ المستحق" : "الإجمالي"}
              </p>
              {hasPriceReduction ? (
                <p className="mt-0.5 text-sm tabular-nums text-muted-foreground line-through decoration-muted-foreground/60">
                  {formatCurrency(cartSubtotal)}
                </p>
              ) : null}
            </div>
            <p
              className={cn(
                "shrink-0 text-2xl font-bold tabular-nums tracking-tight max-[390px]:text-[1.65rem]",
                hasPriceReduction
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-foreground"
              )}
            >
              {formatCurrency(total)}
            </p>
          </div>

          {hasPriceReduction ? (
            <div className="mt-2.5 space-y-1 border-t border-emerald-200/60 pt-2 dark:border-emerald-400/20">
              {promoItemSavings > 0 ? (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">توفير أصناف</span>
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    -{formatCurrency(promoItemSavings)}
                  </span>
                </div>
              ) : null}
              {promoCartDiscount > 0 ? (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">عرض فاتورة</span>
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    -{formatCurrency(promoCartDiscount)}
                  </span>
                </div>
              ) : null}
              {discountAmount > 0 ? (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">خصم يدوي</span>
                  <button
                    type="button"
                    className="font-medium tabular-nums text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                    onClick={() => setDiscountOpen(true)}
                  >
                    -{formatCurrency(discountAmount)}
                  </button>
                </div>
              ) : null}
              {redemptionAmount > 0 ? (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">نقاط ولاء</span>
                  <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    -{formatCurrency(redemptionAmount)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {(loyaltyEnabled && customer && loyaltyBalance === null && hasCart) ||
        loyaltyAvailable ||
        (loyaltyEnabled && customer && (loyaltyBalance ?? 0) > 0 && !loyaltyRedemptionRate && hasCart) ||
        (discountsEnabled && discountOpen) ? (
          <div className="mb-2 max-h-[min(28dvh,12rem)] space-y-2 overflow-y-auto overscroll-y-contain">
            {loyaltyEnabled && customer && loyaltyBalance === null && hasCart ? (
              <p className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
                جاري جلب نقاط الولاء…
              </p>
            ) : null}

            {loyaltyAvailable ? (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-400/30 dark:bg-amber-400/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <Star className="size-3.5" />
                  رصيد النقاط: {loyaltyBalance}
                  {canRedeemLoyalty
                    ? ` · توفّر خصم حتى ${formatCurrency(maxRedeemableAmount)}`
                    : ` · الحد الأدنى ${minimumLoyaltyRedeemPoints} نقطة`}
                </p>
                {canRedeemLoyalty ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 rounded-xl"
                        variant={loyaltyRedemption ? "default" : "outline"}
                        onClick={() => applyRedemption(maxRedeemablePoints)}
                      >
                        استخدم النقاط
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!loyaltyRedemption ? "default" : "outline"}
                        className="h-10 rounded-xl"
                        onClick={() => setLoyaltyRedemption(null)}
                      >
                        بدون نقاط
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={minimumLoyaltyRedeemPoints}
                        max={maxRedeemablePoints}
                        value={loyaltyRedemption?.points ?? ""}
                        placeholder="أو اكتب عدد النقاط"
                        aria-label="نقاط للاستبدال"
                        onChange={(e) => applyRedemption(Number(e.target.value))}
                        className="h-10 rounded-xl bg-background"
                        inputMode="numeric"
                      />
                      {loyaltyRedemption ? (
                        <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          -{formatCurrency(loyaltyRedemption.amount)}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                    العميل محتاج على الأقل {minimumLoyaltyRedeemPoints} نقطة للاستبدال.
                  </p>
                )}
              </div>
            ) : loyaltyEnabled &&
              customer &&
              (loyaltyBalance ?? 0) > 0 &&
              !loyaltyRedemptionRate &&
              hasCart ? (
              <p className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
                النقاط موجودة لكن إعداد الاستبدال غير مفعّل. راجع الولاء من الإعدادات.
              </p>
            ) : null}

            {discountsEnabled && discountOpen ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium" htmlFor="cart-discount">
                    مبلغ الخصم
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 rounded-lg"
                    aria-label="إلغاء الخصم"
                    onClick={() => {
                      setDiscountAmount(0);
                      setDiscountOpen(false);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <Input
                  id="cart-discount"
                  type="number"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="h-11 rounded-xl bg-background"
                  autoFocus
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-2 flex gap-1.5 max-[390px]:mb-1.5">
          {discountsEnabled && !discountOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 min-w-0 flex-1 rounded-xl border-border/80 bg-background px-2 text-xs font-medium shadow-none"
              onClick={() => setDiscountOpen(true)}
            >
              <Percent className="size-3.5 shrink-0" />
              خصم
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-0 flex-1 rounded-xl border-border/80 bg-background px-2 text-xs font-medium shadow-none"
            disabled={!hasCart}
            onClick={() => handleHoldCart()}
          >
            <Pause className="size-3.5 shrink-0" />
            تعليق
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-0 flex-1 rounded-xl border-destructive/25 bg-destructive/5 px-2 text-xs font-medium text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
            disabled={!hasCart}
            onClick={() => setClearConfirmOpen(true)}
          >
            <Trash2 className="size-3.5 shrink-0" />
            مسح
          </Button>
        </div>

        {/* Primary — payment methods */}
        <div
          className={cn(
            "grid gap-1.5",
            methods.length <= 2
              ? "grid-cols-2"
              : methods.length === 3
                ? "grid-cols-3"
                : methods.length === 4
                  ? "grid-cols-2"
                  : "grid-cols-3"
          )}
        >
          {methods.map((method) => {
            const meta = METHOD_META[method];
            const Icon = meta.icon;
            return (
              <Button
                key={method}
                type="button"
                disabled={payDisabled}
                className={cn(
                  "h-16 min-h-16 flex-col gap-0.5 rounded-2xl border font-bold shadow-none transition active:scale-[0.98] max-[390px]:rounded-xl sm:gap-1",
                  meta.className
                )}
                onClick={() => handlePay(method)}
              >
                <Icon className="size-5" />
                <span className="text-sm">{meta.label}</span>
              </Button>
            );
          })}
        </div>
        {hasCart && checkoutBlockedReason ? (
          <p className="mt-2 text-center text-xs text-amber-800 dark:text-amber-200">
            {checkoutBlockedReason}
          </p>
        ) : null}
      </div>

      <ConfirmActionDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="مسح السلة؟"
        description="هتتمسح كل الأصناف من الفاتورة الحالية. الفواتير المعلّقة مش هتتأثر."
        confirmLabel="مسح السلة"
        destructive
        onConfirm={() => {
          clearCart();
          setDiscountOpen(false);
          setLoyaltyRedemption(null);
        }}
      />
    </div>
  );
}
