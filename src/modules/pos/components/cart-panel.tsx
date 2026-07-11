"use client";

import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { CustomerAttach } from "@/modules/pos/components/customer-attach";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

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
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20",
  },
  card: {
    label: "كارت",
    icon: CreditCard,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20",
  },
  wallet: {
    label: "محفظة",
    icon: Wallet,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20",
  },
  other: {
    label: "أخرى",
    icon: Banknote,
    className:
      "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200 dark:hover:bg-slate-500/20",
  },
  credit: {
    label: "آجل",
    icon: UserCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20",
  },
};

const METHOD_ORDER: PaymentMethod[] = ["cash", "card", "wallet", "other", "credit"];

interface CartPanelProps {
  onCheckout: (method?: PaymentMethod) => void;
  checkoutDisabled?: boolean;
  discountsEnabled?: boolean;
  loyaltyEnabled?: boolean;
  enabledPaymentMethods?: PaymentMethod[];
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
}

export function CartPanel({
  onCheckout,
  checkoutDisabled,
  discountsEnabled = false,
  loyaltyEnabled = false,
  enabledPaymentMethods = ["cash", "card", "wallet", "other"],
  loyaltyRedemptionRate = null,
  minimumLoyaltyRedeemPoints = 0,
}: CartPanelProps) {
  const { t } = useTranslation();
  const cart = usePosStore((s) => s.cart);
  const heldCarts = usePosStore((s) => s.heldCarts);
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const setDiscountAmount = usePosStore((s) => s.setDiscountAmount);
  const holdCart = usePosStore((s) => s.holdCart);
  const resumeHeldCart = usePosStore((s) => s.resumeHeldCart);
  const removeHeldCart = usePosStore((s) => s.removeHeldCart);
  const [attachExpanded, setAttachExpanded] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  const subtotal = getCartSubtotal(cart);
  const totalBeforeRedemption = getCartTotal(cart, discountAmount);
  const redemptionAmount = loyaltyRedemption?.amount ?? 0;
  const total = Math.max(0, totalBeforeRedemption - redemptionAmount);
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

  const methods = METHOD_ORDER.filter((method) => enabledPaymentMethods.includes(method));
  const payDisabled = cart.length === 0 || checkoutDisabled;

  function handlePay(method: PaymentMethod) {
    if (payDisabled) return;
    if (method === "credit" && !customer) {
      toast.error("اربط عميلًا أولًا للبيع الآجل");
      setAttachExpanded(true);
      return;
    }
    onCheckout(method);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-card text-card-foreground shadow-none ring-0 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-border">
      <CustomerAttach
        loyaltyEnabled={loyaltyEnabled}
        expanded={attachExpanded}
        onExpandedChange={setAttachExpanded}
      />

      {heldCarts.length > 0 ? (
        <div className="border-b px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Clock3 className="size-3.5" />
            {t("Held orders")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {heldCarts.map((held) => (
              <div
                key={held.id}
                className="flex shrink-0 items-center gap-1 rounded-xl border bg-muted/30 p-1"
              >
                <button
                  type="button"
                  className="max-w-28 truncate px-2 text-sm font-medium"
                  onClick={() => resumeHeldCart(held.id)}
                >
                  {held.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 rounded-lg"
                  onClick={() => removeHeldCart(held.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 [-webkit-overflow-scrolling:touch]">
        {cart.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-muted-foreground">
            {t("Tap products to add items")}
          </p>
        ) : (
          <ul className="space-y-2.5 py-2">
            {cart.map((line) => (
              <li
                key={line.id}
                className="rounded-xl bg-muted/40 px-3 py-3 xl:flex xl:items-start xl:gap-3"
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
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 xl:mt-0 xl:flex-col xl:items-end xl:gap-1">
                  <div className="flex items-center gap-1 xl:gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
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
                      onClick={() => updateQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus className="size-3.5 xl:size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
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

      <div className="border-t p-4">
        <div className="mb-3 flex justify-between text-base">
          <span className="text-muted-foreground">{t("Subtotal")}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && !discountOpen ? (
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("Discount")}</span>
            <button
              type="button"
              className="font-medium tabular-nums text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
              onClick={() => setDiscountOpen(true)}
            >
              -{formatCurrency(discountAmount)}
            </button>
          </div>
        ) : null}
        {loyaltyAvailable ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-medium">
              <Star className="size-4" />
              {t("Customer can redeem points")}
            </p>
            {hasMinimumRedeemPoints ? (
              <p className="mt-1 text-xs">
                {t("Up to")} {maxRedeemablePoints} {t("points")} ={" "}
                {formatCurrency(maxRedeemableAmount)} {t("discount at checkout")}
              </p>
            ) : (
              <p className="mt-1 text-xs">
                {t("Minimum redemption")} {minimumLoyaltyRedeemPoints} {t("points")}
              </p>
            )}
          </div>
        ) : null}
        {redemptionAmount > 0 ? (
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("Points redeemed")}</span>
            <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
              -{formatCurrency(redemptionAmount)}
            </span>
          </div>
        ) : null}
        <Separator className="mb-3" />
        <div className="mb-3 flex justify-between text-base">
          <span className="font-medium">{t("Total")}</span>
          <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
        </div>

        <div className="grid gap-2">
          <div
            className={cn(
              "grid gap-2",
              customer ? "grid-cols-2" : "grid-cols-3"
            )}
          >
            {!customer ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-col gap-1 rounded-xl border-primary/25 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 sm:text-sm"
                onClick={() => setAttachExpanded(true)}
              >
                <UserRound className="size-4" />
                ربط عميل
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={cart.length === 0}
              className="h-12 flex-col gap-1 rounded-xl border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20 sm:text-sm"
              onClick={() => holdCart(customer?.name)}
            >
              <Pause className="size-4" />
              تعليق
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={cart.length === 0}
              className="h-12 flex-col gap-1 rounded-xl border-rose-200 bg-rose-50 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20 sm:text-sm"
              onClick={clearCart}
            >
              <Trash2 className="size-4" />
              مسح
            </Button>
          </div>

          {discountsEnabled && discountOpen ? (
            <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-orange-900 dark:text-orange-200" htmlFor="cart-discount">
                  {t("Discount")}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-8 rounded-lg"
                  aria-label="إغلاق الخصم"
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
              />
            </div>
          ) : null}

          <div
            className={cn(
              "grid gap-2",
              (methods.length + (discountsEnabled ? 1 : 0)) <= 2
                ? "grid-cols-2"
                : (methods.length + (discountsEnabled ? 1 : 0)) === 3
                  ? "grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3"
            )}
          >
            {methods.map((method) => {
              const meta = METHOD_META[method];
              const Icon = meta.icon;
              return (
                <Button
                  key={method}
                  type="button"
                  variant="outline"
                  disabled={payDisabled}
                  className={cn(
                    "h-14 flex-col gap-1 rounded-xl border font-semibold",
                    meta.className
                  )}
                  onClick={() => handlePay(method)}
                >
                  <Icon className="size-5" />
                  <span className="text-xs sm:text-sm">{meta.label}</span>
                </Button>
              );
            })}
            {discountsEnabled ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-14 flex-col gap-1 rounded-xl border font-semibold",
                  discountOpen || discountAmount > 0
                    ? "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-500/50 dark:bg-orange-500/20 dark:text-orange-200"
                    : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20"
                )}
                onClick={() => setDiscountOpen((open) => !open)}
              >
                <Percent className="size-5" />
                <span className="text-xs sm:text-sm">
                  {discountAmount > 0 ? formatCurrency(discountAmount) : "خصم"}
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
