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
import { useTranslation } from "@/lib/i18n/use-translation";
import type { PaymentMethod } from "@/lib/types";
import { createSupplierPaymentAction } from "@/modules/suppliers/actions/supplier.actions";

interface RecordPaymentDialogProps {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordPaymentDialog({
  supplierId,
  open,
  onOpenChange,
  onSuccess,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));

  const reset = () => {
    setAmount("");
    setPaymentMethod("cash");
    setReference("");
    setNotes("");
    setPaidAt(new Date().toISOString().slice(0, 16));
  };

  const submit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error("أدخل مبلغ صحيح");
      return;
    }
    startTransition(async () => {
      const result = await createSupplierPaymentAction({
        supplierId,
        amount: parsed,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        paidAt: new Date(paidAt).toISOString(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم تسجيل الدفعة");
      reset();
      onOpenChange(false);
      onSuccess();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة للمورد</DialogTitle>
          <DialogDescription>أدخل تفاصيل الدفعة — ستُضاف لكشف حساب المورد فورًا.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>المبلغ</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue>{(value) => (value ? t(String(value)) : null)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m} label={t(m)}>
                    {t(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المرجع</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="رقم شيك، تحويل…"
            />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الدفع</Label>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={pending}>
            حفظ الدفعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
