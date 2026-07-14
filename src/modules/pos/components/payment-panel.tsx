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
import { roundMoney } from "@/lib/money";

interface PaymentPanelProps {
  open: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentSplit[]) => void;
  enabledMethods: PaymentMethod[];
  customerName?: string | null;
  loading?: boolean;
  disabled?: boolean;
  loyaltyRedemptionRate?: number | null;
  minimumLoyaltyRedeemPoints?: number;
  /** Use a fixed total instead of the POS cart (e.g. online order checkout). */
  fixedTotal?: number | null;
  /**
   * When true, credit is allowed without a POS-attached customer
   * (online order with a phone that can resolve to a customer account).
   */
  creditCustomerLinked?: boolean;
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
  minimumLoyaltyRedeemPoints = 0,
  fixedTotal = null,
  creditCustomerLinked = false,
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
  const useFixedTotal = fixedTotal !== null && fixedTotal !== undefined;
  const subtotal = useFixedTotal ? fixedTotal : getCartSubtotal(cart);
  const totalBeforeRedemption = useFixedTotal ? fixedTotal : getCartTotal(cart, discountAmount);
  const redemptionAmount = useFixedTotal ? 0 : loyaltyRedemption?.amount ?? 0;
  const total = Math.max(0, totalBeforeRedemption - redemptionAmount);

  const loyaltyAvailable =
    !useFixedTotal &&
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
  const canRedeemLoyalty =
    loyaltyAvailable &&
    maxRedeemablePoints > 0 &&
    maxRedeemablePoints >= minimumLoyaltyRedeemPoints;

  function applyRedemption(points: number) {
    const safePoints = Math.max(0, Math.min(Math.floor(points), maxRedeemablePoints));
    if (
      safePoints <= 0 ||
      safePoints < minimumLoyaltyRedeemPoints ||
      loyaltyRedemptionRate === null
    ) {
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
          { id: "credit", label: "Credit sale", icon: UserCircle },
        ] satisfies { id: PaymentMethod; label: string; icon: typeof Banknote }[]
      ).filter((method) => enabledMethods.includes(method.id)),
    [enabledMethods]
  );

  useEffect(() => {
    if (methods.length > 0 && !enabledMethods.includes(paymentMethod)) {
      setPaymentMethod(methods[0].id);
    }
  }, [enabledMethods, methods, paymentMethod, setPaymentMethod]);

  // Reset split UI whenever the panel is reopened (adjust state during render).
  const [splitResetForOpen, setSplitResetForOpen] = useState(open);
  if (open !== splitResetForOpen) {
    setSplitResetForOpen(open);
    if (open) {
      setSplitMode(false);
      setSplits([]);
    }
  }

  // Keep the first split line in sync when the payable total changes (discount/loyalty).
  const syncedSplits =
    open && splitMode && splits.length === 1
      ? (() => {
          const next = roundMoney(total);
          const first = splits[0]!;
          if (Math.abs(first.amount - next) < 0.005) return splits;
          return [{ method: first.method, amount: next }] as typeof splits;
        })()
      : splits;
  if (syncedSplits !== splits) {
    setSplits(syncedSplits);
  }

  const splitTotal = roundMoney(syncedSplits.reduce((sum, payment) => sum + payment.amount, 0));
  const remaining = roundMoney(Math.max(0, total - splitTotal));
  const overpaid = roundMoney(Math.max(0, splitTotal - total));
  const creditSelected = splitMode
    ? syncedSplits.some((payment) => payment.method === "credit")
    : paymentMethod === "credit";
  const creditAmount = splitMode
    ? roundMoney(
        syncedSplits
          .filter((payment) => payment.method === "credit")
          .reduce((sum, payment) => sum + payment.amount, 0)
      )
    : paymentMethod === "credit"
      ? total
      : 0;
  const hasCustomerForCredit = Boolean(customer) || creditCustomerLinked;
  const creditNeedsCustomer = creditSelected && !hasCustomerForCredit;
  const creditEnabled = methods.some((method) => method.id === "credit");
  const hasCreditSplit = syncedSplits.some((payment) => payment.method === "credit");
  const canComplete =
    !disabled &&
    !loading &&
    !creditNeedsCustomer &&
    total > 0 &&
    (useFixedTotal || cart.length > 0) &&
    methods.length > 0 &&
    (!splitMode || (Math.abs(splitTotal - total) < 0.01 && syncedSplits.length >= 1));

  function addSplit(method: PaymentMethod = methods.find((m) => m.id !== "credit")?.id ?? "cash") {
    if (method === "credit") {
      if (!hasCustomerForCredit || hasCreditSplit || remaining <= 0) return;
    }
    const amount = remaining > 0 ? remaining : 0;
    setSplits((current) => [...current, { method, amount }]);
  }

  function addCreditRemainder() {
    if (!creditEnabled || !hasCustomerForCredit || hasCreditSplit || remaining <= 0) return;
    setSplits((current) => [...current, { method: "credit", amount: remaining }]);
  }

  function updateSplit(index: number, patch: Partial<PaymentSplit>) {
    setSplits((current) =>
      current.map((payment, i) => {
        if (i !== index) return payment;
        if (
          patch.method === "credit" &&
          current.some((other, otherIndex) => otherIndex !== index && other.method === "credit")
        ) {
          return payment;
        }
        return { ...payment, ...patch };
      })
    );
  }

  function normalizePayments(payments: PaymentSplit[]): PaymentSplit[] {
    const rounded = payments
      .map((payment) => ({
        method: payment.method,
        amount: roundMoney(Number(payment.amount) || 0),
      }))
      .filter((payment) => payment.amount > 0);
    if (rounded.length === 0) return rounded;
    const sum = roundMoney(rounded.reduce((s, p) => s + p.amount, 0));
    const diff = roundMoney(total - sum);
    if (Math.abs(diff) >= 0.01) {
      const last = rounded[rounded.length - 1]!;
      last.amount = roundMoney(last.amount + diff);
      if (last.amount <= 0) {
        return rounded.filter((payment) => payment.amount > 0);
      }
    }
    return rounded;
  }

  function complete() {
    const payments = normalizePayments(
      splitMode ? syncedSplits : [{ method: paymentMethod, amount: total }]
    );
    if (payments.length === 0) return;
    if (!useFixedTotal) {
      setPaymentSplits(payments);
    }
    onComplete(payments);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 text-card-foreground shadow-2xl ring-1 ring-border/60 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">{t("Payment")}</h2>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label="إغلاق" onClick={onClose}>
            <X className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 py-3 text-center">
          <p className="text-4xl font-bold tabular-nums tracking-tight">
            {formatCurrency(total)}
          </p>
          {discountAmount > 0 || redemptionAmount > 0 ? (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {formatCurrency(subtotal)} {t("subtotal")}
              {discountAmount > 0
                ? ` · -${formatCurrency(discountAmount)} ${t("discount")}`
                : ""}
              {redemptionAmount > 0
                ? ` · -${formatCurrency(redemptionAmount)} ${t("points")}`
                : ""}
            </p>
          ) : null}
        </div>

        {customerName ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {t("Customer")}: <span className="font-medium text-foreground">{customerName}</span>
          </p>
        ) : null}

        {creditSelected && hasCustomerForCredit ? (
          <p className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
            {t("Credit sale will be charged to the customer account")}
          </p>
        ) : null}

        {creditNeedsCustomer ? (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:text-amber-200">
            {t("Select a customer for credit sale")}
          </p>
        ) : null}

        {!useFixedTotal && loyaltyAvailable ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
              <Star className="size-4" />
              {t("Loyalty points")}: {loyaltyBalance}
            </p>
            {canRedeemLoyalty ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2">
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
                    className="h-11 rounded-xl"
                    variant={!loyaltyRedemption ? "default" : "outline"}
                    onClick={() => setLoyaltyRedemption(null)}
                  >
                    بدون نقاط
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={minimumLoyaltyRedeemPoints}
                    max={maxRedeemablePoints}
                    value={loyaltyRedemption?.points ?? ""}
                    placeholder={t("Points to redeem")}
                    onChange={(e) => applyRedemption(Number(e.target.value))}
                    className="h-10 rounded-xl bg-background"
                  />
                </div>
              </>
            ) : null}
            {loyaltyRedemption ? (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                {loyaltyRedemption.points} {t("points")} = -
                {formatCurrency(loyaltyRedemption.amount)}
              </p>
            ) : !canRedeemLoyalty ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {t("Minimum redemption")} {minimumLoyaltyRedeemPoints} {t("points")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                {t("Max")} {maxRedeemablePoints} {t("points")} (
                {formatCurrency(
                  Math.round(maxRedeemablePoints * (loyaltyRedemptionRate ?? 0) * 100) / 100
                )}
                )
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{t("Method")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              const next = !splitMode;
              setSplitMode(next);
              if (next) {
                const seedMethod =
                  methods.find((m) => m.id !== "credit")?.id ?? methods[0]?.id ?? "cash";
                setSplits([{ method: seedMethod, amount: total }]);
                if (paymentMethod === "credit") setPaymentMethod(seedMethod);
              } else {
                setSplits([]);
              }
            }}
          >
            {splitMode ? t("Single payment") : t("Split")}
          </Button>
        </div>
        {splitMode && creditEnabled ? (
          <p className="mb-3 text-xs text-muted-foreground">
            تقدر تدفع جزء وتخلي الباقي آجل على حساب العميل.
          </p>
        ) : null}
        {!splitMode ? (
        <div className="mb-5 grid grid-cols-2 gap-3">
          {methods.map(({ id, label, icon: Icon }) => {
            const selected = paymentMethod === id;
            const tone =
              id === "cash"
                ? "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700"
                : id === "card"
                  ? "border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
                  : id === "wallet"
                    ? "border-violet-300 bg-violet-600 text-white hover:bg-violet-700"
                    : id === "credit"
                      ? "border-amber-300 bg-amber-500 text-amber-950 hover:bg-amber-400"
                      : "border-slate-300 bg-slate-700 text-white hover:bg-slate-800";
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPaymentMethod(id)}
                className={cn(
                  "flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 py-5 font-semibold transition active:scale-[0.98] sm:min-h-28",
                  tone,
                  selected && "ring-2 ring-offset-2 ring-foreground/30"
                )}
              >
                <Icon className="size-8" />
                <span>{t(label)}</span>
              </button>
            );
          })}
        </div>
        ) : (
          <div className="mb-5 grid gap-2.5">
            {syncedSplits.map((payment, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <select
                  value={payment.method}
                  onChange={(e) => updateSplit(index, { method: e.target.value as PaymentMethod })}
                  className="h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {methods.map((method) => (
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
                  aria-label="حذف الدفعة"
                  onClick={() => setSplits((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span
                className={
                  remaining === 0 && overpaid === 0
                    ? "text-muted-foreground"
                    : "text-amber-700 dark:text-amber-300"
                }
              >
                {overpaid > 0
                  ? `${t("Overpaid")} ${formatCurrency(overpaid)}`
                  : `${t("Remaining")} ${formatCurrency(remaining)}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {creditEnabled && hasCustomerForCredit && remaining > 0 && !hasCreditSplit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={addCreditRemainder}
                  >
                    الباقي آجل
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={remaining <= 0}
                  onClick={() => addSplit()}
                >
                  <Plus className="size-4" />
                  {t("Add payment")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Button
          className="h-14 w-full rounded-2xl text-base font-semibold"
          disabled={!canComplete}
          onClick={complete}
        >
          {loading
            ? t("Processing…")
            : creditSelected && creditAmount > 0 && creditAmount + 0.001 < total
              ? `${t("Complete")} · ${formatCurrency(total)} · ${t("Credit sale")} ${formatCurrency(creditAmount)}`
              : creditSelected
                ? `${t("Credit sale")} · ${formatCurrency(total)}`
                : `${t("Complete")} · ${formatCurrency(total)}`}
        </Button>
        {creditNeedsCustomer ? (
          <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
            {t("Select a customer for credit sale")}
          </p>
        ) : null}
        {splitMode && !canComplete && !loading && !disabled && overpaid === 0 && remaining > 0 ? (
          <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
            {t("Split amounts must equal total")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
