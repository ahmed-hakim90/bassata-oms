"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Plus, Trash2, UserCircle, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, PaymentSplit } from "@/lib/types";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { cn } from "@/lib/utils";

interface PaymentPanelProps {
  open: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentSplit[]) => void;
  enabledMethods: PaymentMethod[];
  customerName?: string | null;
  loading?: boolean;
  disabled?: boolean;
}

export function PaymentPanel({
  open,
  onClose,
  onComplete,
  enabledMethods,
  customerName,
  loading,
  disabled,
}: PaymentPanelProps) {
  const cart = usePosStore((s) => s.cart);
  const paymentMethod = usePosStore((s) => s.paymentMethod);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod);
  const setPaymentSplits = usePosStore((s) => s.setPaymentSplits);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const subtotal = getCartSubtotal(cart);
  const total = getCartTotal(cart, discountAmount);

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
          <h2 className="font-heading text-xl font-semibold">Payment</h2>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <p className="mb-2 text-center text-4xl font-bold tabular-nums tracking-tight">
          {formatCurrency(total)}
        </p>
        {discountAmount > 0 ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            {formatCurrency(subtotal)} subtotal · {formatCurrency(discountAmount)} discount
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {customerName ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Customer: <span className="font-medium text-foreground">{customerName}</span>
          </p>
        ) : null}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">Method</p>
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
            {splitMode ? "Single payment" : "Split"}
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
              <span className="font-medium">{label}</span>
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
                        {method.label}
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
                Remaining {formatCurrency(remaining)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => addSplit()}
              >
                <Plus className="size-4" />
                Add payment
              </Button>
            </div>
          </div>
        )}

        <Button
          className="h-14 w-full rounded-xl text-base font-semibold"
          disabled={!canComplete}
          onClick={complete}
        >
          {loading ? "Processing…" : `Complete · ${formatCurrency(total)}`}
        </Button>
      </div>
    </div>
  );
}
