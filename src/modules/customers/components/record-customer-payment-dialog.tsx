"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { recordCustomerPaymentAction } from "@/modules/customers/actions/customer.actions";
import { TreasuryPicker } from "@/modules/treasury/components/treasury-picker";

interface RecordCustomerPaymentDialogProps {
  customerId: string;
  accountBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  storeId?: string;
}

export function RecordCustomerPaymentDialog({
  customerId,
  accountBalance,
  open,
  onOpenChange,
  onSuccess,
  storeId,
}: RecordCustomerPaymentDialogProps) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [treasuryId, setTreasuryId] = useState("");

  const reset = () => {
    setAmount("");
    setMethod("cash");
    setReference("");
    setTreasuryId("");
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
    if (method === "cash" && !treasuryId) {
      toast.error("اختار الخزينة اللي هيتحط فيها التحصيل النقدي");
      return;
    }
    startTransition(async () => {
      try {
        const result = await recordCustomerPaymentAction({
          customerId,
          amount: collectValue,
          paymentMethod: method,
          reference,
          treasuryId: method === "cash" ? treasuryId : null,
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
      <StandardModalContent
        size="sm"
        title="تحصيل دفعة"
        description={`المستحق الحالي ${formatCurrency(accountBalance)}`}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl font-semibold"
              onClick={submit}
              disabled={pending || amountTooHigh}
            >
              {pending ? "جاري الحفظ…" : "تسجيل التحصيل"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="customer-collect-amount">المبلغ</Label>
            <Input
              id="customer-collect-amount"
              type="number"
              min="0"
              max={accountBalance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11"
            />
            {amountTooHigh ? (
              <p className="text-xs text-destructive">المبلغ أكبر من المستحق</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>الطريقة</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-11">
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
          {method === "cash" ? (
            <TreasuryPicker
              value={treasuryId}
              onChange={setTreasuryId}
              preferredStoreId={storeId}
              label="إيداع في خزينة"
            />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="customer-collect-ref">مرجع</Label>
            <Input
              id="customer-collect-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
