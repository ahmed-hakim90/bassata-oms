"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
      toast.error("Enter a valid amount");
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
      toast.success("Payment recorded");
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
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Check #, transfer ref..."
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Paid at</Label>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={pending}>
            Save payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
