"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { recordCustomerPaymentAction } from "@/modules/customers/actions/customer.actions";

interface RecordCustomerPaymentDialogProps {
  customerId: string;
  accountBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordCustomerPaymentDialog({
  customerId,
  accountBalance,
  open,
  onOpenChange,
  onSuccess,
}: RecordCustomerPaymentDialogProps) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const reset = () => {
    setAmount("");
    setMethod("cash");
    setReference("");
  };

  const collectValue = Number(amount);
  const amountTooHigh =
    Number.isFinite(collectValue) && collectValue > accountBalance + 0.001;

  const submit = () => {
    if (!Number.isFinite(collectValue) || collectValue <= 0) {
      toast.error("اكتب مبلغ صحيح");
      return;
    }
    if (amountTooHigh) {
      toast.error("المبلغ أكبر من المستحق");
      return;
    }
    startTransition(async () => {
      try {
        const result = await recordCustomerPaymentAction({
          customerId,
          amount: collectValue,
          paymentMethod: method,
          reference,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        reset();
        toast.success("تم تسجيل التحصيل");
        onOpenChange(false);
        onSuccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر تسجيل التحصيل");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تحصيل دفعة</DialogTitle>
          <DialogDescription>
            المستحق الحالي {formatCurrency(accountBalance)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-[var(--mds-space-3)]">
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="customer-collect-amount">المبلغ</Label>
            <Input
              id="customer-collect-amount"
              type="number"
              min="0"
              max={accountBalance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-[var(--mds-radius-md)]"
            />
            {amountTooHigh ? (
              <p className="text-xs text-destructive">المبلغ أكبر من المستحق</p>
            ) : null}
          </div>
          <div className="space-y-[var(--mds-space-2)]">
            <Label>الطريقة</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="rounded-[var(--mds-radius-md)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                  <SelectItem key={m} value={m} label={m}>
                    {m === "cash"
                      ? "كاش"
                      : m === "card"
                        ? "كارت"
                        : m === "wallet"
                          ? "محفظة"
                          : "أخرى"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="customer-collect-ref">مرجع</Label>
            <Input
              id="customer-collect-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <Button
            onClick={submit}
            disabled={pending || amountTooHigh}
            className="shadow-[var(--mds-elevation-1)]"
          >
            {pending ? "جاري الحفظ…" : "تسجيل التحصيل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
