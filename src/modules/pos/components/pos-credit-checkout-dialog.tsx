"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, UserCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import type { Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAY_NOW_METHODS: {
  id: Exclude<PaymentMethod, "credit">;
  label: string;
  icon: typeof Banknote;
  className: string;
}[] = [
  {
    id: "cash",
    label: "نقدي",
    icon: Banknote,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 data-[selected=true]:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  {
    id: "card",
    label: "كارت",
    icon: CreditCard,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 data-[selected=true]:border-sky-500 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  },
  {
    id: "wallet",
    label: "محفظة",
    icon: Wallet,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 data-[selected=true]:border-violet-500 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  },
  {
    id: "other",
    label: "أخرى",
    icon: Banknote,
    className:
      "border-slate-200 bg-slate-50 text-slate-800 data-[selected=true]:border-slate-500 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
  },
];

interface PosCreditCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  customer: Customer | null;
  enabledMethods: PaymentMethod[];
  loading?: boolean;
  onConfirm: (payments: PaymentSplit[]) => void;
}

export function PosCreditCheckoutDialog({
  open,
  onOpenChange,
  total,
  customer,
  enabledMethods,
  loading = false,
  onConfirm,
}: PosCreditCheckoutDialogProps) {
  const [payNow, setPayNow] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");

  const availablePayMethods = useMemo(
    () => PAY_NOW_METHODS.filter((method) => enabledMethods.includes(method.id)),
    [enabledMethods]
  );

  const [initOpen, setInitOpen] = useState(open);
  if (open !== initOpen) {
    setInitOpen(open);
    if (open) {
      setPayNow(false);
      setAmountPaid("");
      setPayMethod(availablePayMethods[0]?.id ?? "cash");
    }
  }

  const paidValue = Number(amountPaid);
  const paid = payNow && Number.isFinite(paidValue) ? Math.max(0, paidValue) : 0;
  const creditRemainder = Math.round(Math.max(0, total - paid) * 100) / 100;
  const paidRounded = Math.round(paid * 100) / 100;
  const amountTooHigh = payNow && paidRounded > total + 0.001;
  const amountInvalid = payNow && (!Number.isFinite(paidValue) || paidValue < 0);
  const canSubmit =
    Boolean(customer) &&
    total > 0 &&
    !loading &&
    !amountTooHigh &&
    !amountInvalid &&
    creditRemainder > 0.001 &&
    (!payNow || paidRounded > 0);

  function handleConfirm() {
    if (!canSubmit || !customer) return;
    if (!payNow || paidRounded <= 0) {
      onConfirm([{ method: "credit", amount: total }]);
      return;
    }
    onConfirm([
      { method: payMethod, amount: paidRounded },
      { method: "credit", amount: creditRemainder },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl sm:max-w-md">
        <DialogHeader className="space-y-3 text-start">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
            <UserCircle className="size-5" />
          </div>
          <DialogTitle>بيع آجل</DialogTitle>
          <DialogDescription>
            {customer
              ? `${customer.name} · إجمالي الفاتورة ${formatCurrency(total)}`
              : "اربط عميلًا أولًا لإتمام البيع الآجل"}
          </DialogDescription>
        </DialogHeader>

        {customer ? (
          <div className="space-y-4">
            {customer.account_balance > 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                مستحق حاليًا على الحساب: {formatCurrency(customer.account_balance)}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayNow(false);
                  setAmountPaid("");
                }}
                className={cn(
                  "rounded-xl border-2 px-3 py-3 text-start transition",
                  !payNow
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-500/15"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-sm font-semibold">مش هيدفع دلوقتي</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  كل المبلغ ({formatCurrency(total)}) على الحساب
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPayNow(true)}
                className={cn(
                  "rounded-xl border-2 px-3 py-3 text-start transition",
                  payNow
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <p className="text-sm font-semibold">هيدفع جزء</p>
                <p className="mt-1 text-xs text-muted-foreground">والباقي يتسجل آجل</p>
              </button>
            </div>

            {payNow ? (
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label htmlFor="credit-pay-now-amount">المبلغ المدفوع دلوقتي</Label>
                  <Input
                    id="credit-pay-now-amount"
                    type="number"
                    min={0}
                    max={total}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-11 rounded-xl text-base"
                    autoFocus
                    placeholder="0.00"
                  />
                  {amountTooHigh ? (
                    <p className="text-xs text-destructive">المبلغ أكبر من إجمالي الفاتورة</p>
                  ) : null}
                </div>
                {availablePayMethods.length > 0 ? (
                  <div className="space-y-2">
                    <Label>طريقة الدفع الحالية</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {availablePayMethods.map(({ id, label, icon: Icon, className }) => (
                        <button
                          key={id}
                          type="button"
                          data-selected={payMethod === id}
                          onClick={() => setPayMethod(id)}
                          className={cn(
                            "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-semibold",
                            className
                          )}
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">إجمالي الفاتورة</span>
                <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">هيدفع دلوقتي</span>
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(paidRounded)}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-t border-amber-200/70 pt-2 dark:border-amber-500/20">
                <span className="font-medium">هيفضل آجل</span>
                <span className="font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {formatCurrency(creditRemainder)}
                </span>
              </div>
              {customer.account_balance > 0 ? (
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>مستحق بعد العملية</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      Math.round((customer.account_balance + creditRemainder) * 100) / 100
                    )}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            اربط عميلًا من السلة أولًا، بعدين اختار آجل عشان نسجّل المبلغ على حسابه.
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleConfirm}>
            {loading ? "جاري الحفظ…" : "تأكيد البيع الآجل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
