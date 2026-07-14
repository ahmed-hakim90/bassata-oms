"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Clock3,
  CreditCard,
  Minus,
  Pause,
  Percent,
  Plus,
  Star,
  Trash2,
  UserCircle,
  UserRound,
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
import {
  discardHeldCartAction,
  holdCartAction,
  resumeHeldCartAction,
} from "@/modules/pos/actions/held-cart.actions";

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
  promotionsEnabled?: boolean;
  promoCartDiscount?: number;
  promoItemSavings?: number;
  promoAdjustedSubtotal?: number | null;
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
  promotionsEnabled = false,
  promoCartDiscount = 0,
  promoItemSavings = 0,
  promoAdjustedSubtotal = null,
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
  const heldCarts = usePosStore((s) => s.heldCarts);
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const couponCode = usePosStore((s) => s.couponCode);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const setDiscountAmount = usePosStore((s) => s.setDiscountAmount);
  const setCouponCode = usePosStore((s) => s.setCouponCode);
  const setLoyaltyRedemption = usePosStore((s) => s.setLoyaltyRedemption);
  const holdCartLocal = usePosStore((s) => s.holdCart);
  const reconcileHeldCartId = usePosStore((s) => s.reconcileHeldCartId);
  const resumeHeldCart = usePosStore((s) => s.resumeHeldCart);
  const removeHeldCart = usePosStore((s) => s.removeHeldCart);
  const salesMode = usePosStore((s) => s.salesMode);
  const [attachExpandedInternal, setAttachExpandedInternal] = useState(false);
  const [discountOpenInternal, setDiscountOpenInternal] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [heldDeleteId, setHeldDeleteId] = useState<string | null>(null);
  const [discardPending, startDiscardTransition] = useTransition();

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

  function handleResumeHeldCart(id: string) {
    const state = usePosStore.getState();
    const target = state.heldCarts.find((held) => held.id === id);
    if (!target) return;
    if (target.id.startsWith("temp-hold-")) {
      toast.error("لسه بنحفظ الفاتورة المعلّقة… حاول تاني لحظات");
      return;
    }

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

    const parkCurrent =
      state.cart.length > 0
        ? {
            name: state.customer?.name,
            cart: [...state.cart],
            customer: state.customer,
            discountAmount: state.discountAmount,
            couponCode: state.couponCode,
            salesMode: state.salesMode,
          }
        : null;

    const parkedLocal =
      parkCurrent && parkCurrent.cart.length > 0
        ? {
            id: `temp-hold-${crypto.randomUUID()}`,
            name:
              parkCurrent.name?.trim() ||
              parkCurrent.customer?.name ||
              `معلّقة ${state.heldCarts.length + 1}`,
            cart: parkCurrent.cart,
            customer: parkCurrent.customer,
            discountAmount: parkCurrent.discountAmount,
            couponCode: parkCurrent.couponCode,
            salesMode: parkCurrent.salesMode,
            createdAt: new Date().toISOString(),
          }
        : null;

    const ok = resumeHeldCart(id, parkedLocal);
    if (!ok) {
      toast.error("الفاتورة المعلّقة غير موجودة");
      return;
    }

    void resumeHeldCartAction({
      resumeId: id,
      parkCurrent,
    }).then((result) => {
      if (!result.success) {
        usePosStore.setState(snapshot);
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      if (parkedLocal && result.parked) {
        reconcileHeldCartId(parkedLocal.id, result.parked);
      }
    });
  }

  function handleDiscardHeldCart(id: string) {
    if (id.startsWith("temp-hold-")) {
      removeHeldCart(id);
      return;
    }
    startDiscardTransition(async () => {
      const result = await discardHeldCartAction(id);
      if (!result.success) {
        playPosErrorSound();
        toast.error(result.error);
        return;
      }
      removeHeldCart(id);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-card text-card-foreground shadow-none ring-0 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-border">
      <CustomerAttach
        loyaltyEnabled={loyaltyEnabled}
        expanded={attachExpanded}
        onExpandedChange={setAttachExpanded}
      />

      {heldCarts.length > 0 ? (
        <div className="border-b px-3 py-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock3 className="size-3.5" />
            فواتير معلّقة
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {heldCarts.map((held) => (
              <div
                key={held.id}
                className="flex shrink-0 items-center gap-1 rounded-xl border bg-muted/30 p-1"
              >
                <button
                  type="button"
                  className="max-w-28 truncate px-2 text-sm font-medium"
                  onClick={() => handleResumeHeldCart(held.id)}
                  disabled={held.id.startsWith("temp-hold-") || discardPending}
                >
                  {held.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 rounded-lg"
                  aria-label="حذف الفاتورة المعلقة"
                  disabled={discardPending}
                  onClick={() => setHeldDeleteId(held.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 [-webkit-overflow-scrolling:touch]">
        {!hasCart ? (
          <EmptyStateBlock
            title="السلة فاضية"
            description="اضغط على المنتجات لإضافة أصناف"
            className="mx-2 my-6 border-border/60 bg-transparent p-4 py-8"
          />
        ) : (
          <ul className="space-y-1.5 py-2">
            {cart.map((line) => (
              <li
                key={line.id}
                className="rounded-xl bg-muted/40 px-3 py-2.5 ring-1 ring-border/40 xl:flex xl:items-start xl:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 xl:block">
                    <p className="text-sm font-medium leading-snug xl:truncate xl:text-base">
                      {line.name}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums xl:hidden">
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
                <div className="mt-2.5 flex items-center justify-between gap-2 xl:mt-0 xl:flex-col xl:items-end xl:gap-1">
                  <div className="flex items-center gap-1 xl:gap-1.5">
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
                      className="size-9 rounded-xl xl:size-11"
                      aria-label="تقليل الكمية"
                      onClick={() => updateQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus className="size-3.5 xl:size-4" />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums xl:w-8 xl:text-base">
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
                      aria-label="زيادة الكمية"
                      onClick={() => updateQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus className="size-3.5 xl:size-4" />
                    </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
                      aria-label="حذف الصنف"
                      onClick={() => removeItem(line.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground xl:size-4" />
                    </Button>
                  </div>
                  <p className="hidden text-base font-semibold tabular-nums xl:block">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border/60 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
          {(discountAmount > 0 ||
            redemptionAmount > 0 ||
            promoCartDiscount > 0 ||
            promoItemSavings > 0) && (
            <div className="flex justify-between pb-1.5 text-sm text-muted-foreground">
              <span>قبل الخصم</span>
              <span className="tabular-nums">
                {formatCurrency(getCartSubtotal(cart))}
              </span>
            </div>
          )}
          {promoItemSavings > 0 ? (
            <div className="flex justify-between pb-1 text-sm">
              <span className="text-muted-foreground">توفير أصناف</span>
              <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                -{formatCurrency(promoItemSavings)}
              </span>
            </div>
          ) : null}
          {promoCartDiscount > 0 ? (
            <div className="flex justify-between pb-1 text-sm">
              <span className="text-muted-foreground">عرض فاتورة</span>
              <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                -{formatCurrency(promoCartDiscount)}
              </span>
            </div>
          ) : null}
          {discountAmount > 0 ? (
            <div className="flex justify-between pb-1 text-sm">
              <span className="text-muted-foreground">خصم</span>
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
            <div className="flex justify-between pb-1 text-sm">
              <span className="text-muted-foreground">نقاط</span>
              <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                -{formatCurrency(redemptionAmount)}
              </span>
            </div>
          ) : null}
          {(discountAmount > 0 ||
            redemptionAmount > 0 ||
            promoCartDiscount > 0 ||
            promoItemSavings > 0) && (
            <div className="mb-1.5 border-t border-border/50" />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">الإجمالي</span>
            <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {loyaltyEnabled && customer && loyaltyBalance === null && hasCart ? (
          <p className="mb-2 rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
            جاري جلب نقاط الولاء…
          </p>
        ) : null}

        {loyaltyAvailable ? (
          <div className="mb-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-400/30 dark:bg-amber-400/10">
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
                    className="h-11 rounded-xl"
                    variant={loyaltyRedemption ? "default" : "outline"}
                    onClick={() => applyRedemption(maxRedeemablePoints)}
                  >
                    استخدم النقاط
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!loyaltyRedemption ? "default" : "outline"}
                    className="h-11 rounded-xl"
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
        ) : loyaltyEnabled && customer && (loyaltyBalance ?? 0) > 0 && !loyaltyRedemptionRate && hasCart ? (
          <p className="mb-2 rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
            النقاط موجودة لكن إعداد الاستبدال غير مفعّل. راجع الولاء من الإعدادات.
          </p>
        ) : loyaltyEnabled && !customer && hasCart ? (
          <p className="mb-2 rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
            لاختيار استبدال النقاط: اربط عميلاً بالسلة أولاً.
          </p>
        ) : null}

        {discountsEnabled && discountOpen ? (
          <div className="mb-2 space-y-2 rounded-xl border border-border bg-muted/40 p-2.5">
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
            {promotionsEnabled ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="cart-coupon">
                  كود خصم
                </label>
                <Input
                  id="cart-coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="SAVE10"
                  className="h-11 rounded-xl bg-background uppercase"
                  autoCapitalize="characters"
                />
              </div>
            ) : null}
          </div>
        ) : promotionsEnabled ? (
          <div className="mb-2 space-y-1.5 rounded-xl border border-border bg-muted/40 p-2.5">
            <label className="text-sm font-medium" htmlFor="cart-coupon-standalone">
              كود خصم
            </label>
            <Input
              id="cart-coupon-standalone"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="SAVE10"
              className="h-11 rounded-xl bg-background uppercase"
              autoCapitalize="characters"
            />
          </div>
        ) : null}

        {/* Secondary tools — quiet, not competing with pay */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {!customer ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg px-2.5 text-xs"
              onClick={() => setAttachExpanded(true)}
            >
              <UserRound className="size-3.5" />
              عميل
            </Button>
          ) : null}
          {discountsEnabled && !discountOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg px-2.5 text-xs"
              onClick={() => setDiscountOpen(true)}
            >
              <Percent className="size-3.5" />
              خصم
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg px-2.5 text-xs"
            disabled={!hasCart}
            onClick={() => handleHoldCart()}
          >
            <Pause className="size-3.5" />
            تعليق
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg px-2.5 text-xs text-destructive hover:text-destructive"
            disabled={!hasCart}
            onClick={() => setClearConfirmOpen(true)}
          >
            <Trash2 className="size-3.5" />
            مسح
          </Button>
        </div>

        {/* Primary — payment methods */}
        <div
          className={cn(
            "grid gap-2",
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
                  "h-16 min-h-16 flex-col gap-1 rounded-2xl border font-bold shadow-none",
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
      <ConfirmActionDialog
        open={Boolean(heldDeleteId)}
        onOpenChange={(open) => {
          if (!open) setHeldDeleteId(null);
        }}
        title="حذف الفاتورة المعلّقة؟"
        description="هتتمسح الفاتورة المعلّقة ومش هتقدر ترجعها."
        confirmLabel="حذف"
        destructive
        onConfirm={() => {
          if (heldDeleteId) handleDiscardHeldCart(heldDeleteId);
          setHeldDeleteId(null);
        }}
      />
    </div>
  );
}
