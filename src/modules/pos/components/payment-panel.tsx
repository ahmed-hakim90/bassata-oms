"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Plus, Star, Trash2, UserCircle, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, PaymentSplit } from "@/lib/types";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

interface PaymentPanelProps {
  open: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentSplit[]) => void;
  enabledMethods: PaymentMethod[];
  customerName?: string | null;
  loading?: boolean;
  disabled?: boolean;
  loyaltyRedemptionRate?: number | null;
}

export function PaymentPanel({
  open,
  onClose,
  onComplete,
  enabledMethods,
  customerName,
  loading,
  disabled,
  loyaltyRedemptionRate = null,
}: PaymentPanelProps) {
  const { t } = useTranslation();
  const cart = usePosStore((s) => s.cart);
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const loyaltyRedemption = usePosStore((s) => s.loyaltyRedemption);
  const setLoyaltyRedemption = usePosStore((s) => s.setLoyaltyRedemption);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
  const setPaymentSplits = usePosStore((s) => s.setPaymentSplits);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const subtotal = getCartSubtotal(cart);
  const totalBeforeRedemption = getCartTotal(cart, discountAmount);
  const redemptionAmount = loyaltyRedemption?.amount ?? 0;
  const total = Math.max(0, totalBeforeRedemption - redemptionAmount);

  const loyaltyAvailable =
    Boolean(customer) &&
    loyaltyRedemptionRate !== null &&
    loyaltyRedemptionRate > 0 &&
    (loyaltyBalance ?? 0) > 0;
  const maxRedeemablePoints = loyaltyAvailable
    ? Math.min(
        loyaltyBalance ?? 0,
        Math.floor(totalBeforeRedemption / (loyaltyRedemptionRate as number))
      )
    : 0;

  function applyRedemption(points: number) {
    const safePoints = Math.max(0, Math.min(Math.floor(points), maxRedeemablePoints));
    if (safePoints <= 0 || loyaltyRedemptionRate === null) {
      setLoyaltyRedemption(null);
      return;
    }
    const amount =
      Math.round(safePoints * loyaltyRedemptionRate * 100) / 100;
    setLoyaltyRedemption({ points: safePoints, amount });
  }

  const methods = useMemo(
    () =>
      (
        [
          { id: "cash", label: "Cash", icon: Banknote },
          { id: "card", label: "Card", icon: CreditCard },
          { id: "wallet", label: "Wallet", icon: Wallet },
          { id: "other", label: "Other", icon: Banknote },
          { id: "credit", label: "Credit", icon: UserCircle },
        ] satisfies { id: PaymentMethod; label: string; icon: typeof Banknote }[]
      ).filter((method) => enabledMethods.includes(method.id)),
    [enabledMethods]
  );

  useEffect(() => {
    if (methods.length > 0 && !enabledMethods.includes(paymentMethod)) {
      setPaymentMethod(methods[0].id);
    }
  }, [enabledMethods, methods, paymentMethod, setPaymentMethod]);

  const splitTotal = splits.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, total - splitTotal);
  const creditSelected = splitMode
    ? splits.some((payment) => payment.method === "credit")
    : paymentMethod === "credit";
  const canComplete =
    !disabled &&
    !loading &&
    cart.length > 0 &&
    methods.length > 0 &&
    (!splitMode || (Math.abs(splitTotal - total) < 0.01 && !creditSelected));

  function addSplit(method: PaymentMethod = methods[0]?.id ?? "cash") {
    if (method === "credit") return;
    const amount = remaining > 0 ? remaining : 0;
    setSplits((current) => [...current, { method, amount }]);
  }

  function updateSplit(index: number, patch: Partial<PaymentSplit>) {
    setSplits((current) =>
      current.map((payment, i) => (i === index ? { ...payment, ...patch } : payment))
    );
  }

  function complete() {
    const payments = splitMode
      ? splits
      : [{ method: paymentMethod, amount: total }];
    setPaymentSplits(payments);
    onComplete(payments);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">{t("Payment")}</h2>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <p className="mb-2 text-center text-4xl font-bold tabular-nums tracking-tight">
          {formatCurrency(total)}
        </p>
        {discountAmount > 0 || redemptionAmount > 0 ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {formatCurrency(subtotal)} {t("subtotal")}
            {discountAmount > 0
              ? ` · ${formatCurrency(discountAmount)} ${t("discount")}`
              : ""}
            {redemptionAmount > 0
              ? ` · ${formatCurrency(redemptionAmount)} ${t("points")}`
              : ""}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {customerName ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {t("Customer")}: <span className="font-medium text-foreground">{customerName}</span>
          </p>
        ) : null}

        {loyaltyAvailable ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <Star className="size-4" />
                {t("Loyalty points")}: {loyaltyBalance}
              </p>
              {loyaltyRedemption ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-amber-800"
                  onClick={() => setLoyaltyRedemption(null)}
                >
                  {t("Remove")}
                </Button>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={maxRedeemablePoints}
                value={loyaltyRedemption?.points ?? ""}
                placeholder={t("Points to redeem")}
                onChange={(e) => applyRedemption(Number(e.target.value))}
                className="h-10 rounded-xl bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 rounded-xl"
                onClick={() => applyRedemption(maxRedeemablePoints)}
              >
                {t("Use max")}
              </Button>
            </div>
            {loyaltyRedemption ? (
              <p className="mt-2 text-xs text-amber-800">
                {loyaltyRedemption.points} {t("points")} = -
                {formatCurrency(loyaltyRedemption.amount)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                {t("Max")} {maxRedeemablePoints} {t("points")} (
                {formatCurrency(
                  Math.round(maxRedeemablePoints * (loyaltyRedemptionRate ?? 0) * 100) / 100
                )}
                )
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{t("Method")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={paymentMethod === "credit"}
            onClick={() => {
              const next = !splitMode;
              setSplitMode(next);
              setSplits(next ? [{ method: methods.find((m) => m.id !== "credit")?.id ?? "cash", amount: total }] : []);
            }}
          >
            {splitMode ? t("Single payment") : t("Split")}
          </Button>
        </div>
        {!splitMode ? (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {methods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id)}
              className={cn(
                "flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 py-6 transition active:scale-[0.98] sm:min-h-32",
                paymentMethod === id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Icon
                className={cn(
                  "size-8",
                  paymentMethod === id
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
              <span className="font-medium">{t(label)}</span>
            </button>
          ))}
        </div>
        ) : (
          <div className="mb-6 grid gap-3">
            {splits.map((payment, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <select
                  value={payment.method}
                  onChange={(e) => updateSplit(index, { method: e.target.value as PaymentMethod })}
                  className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                >
                  {methods
                    .filter((method) => method.id !== "credit")
                    .map((method) => (
                      <option key={method.id} value={method.id}>
                        {t(method.label)}
                      </option>
                    ))}
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payment.amount || ""}
                  onChange={(e) => updateSplit(index, { amount: Number(e.target.value) })}
                  className="h-11 rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl"
                  onClick={() => setSplits((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className={remaining === 0 ? "text-muted-foreground" : "text-amber-700"}>
                {t("Remaining")} {formatCurrency(remaining)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => addSplit()}
              >
                <Plus className="size-4" />
                {t("Add payment")}
              </Button>
            </div>
          </div>
        )}

        <Button
          className="h-14 w-full rounded-xl text-base font-semibold"
          disabled={!canComplete}
          onClick={complete}
        >
          {loading ? t("Processing…") : `${t("Complete")} · ${formatCurrency(total)}`}
        </Button>
      </div>
    </div>
  );
}
