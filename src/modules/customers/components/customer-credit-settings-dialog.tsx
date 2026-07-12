"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateCustomerAction } from "@/modules/customers/actions/customer.actions";

interface CustomerCreditSettingsDialogProps {
  customerId: string;
  creditLimit: number;
  paymentTerms: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerCreditSettingsDialog({
  customerId,
  creditLimit,
  paymentTerms,
  open,
  onOpenChange,
}: CustomerCreditSettingsDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState(String(creditLimit));
  const [terms, setTerms] = useState(paymentTerms);

  const syncFromProps = (nextOpen: boolean) => {
    if (nextOpen) {
      setLimit(String(creditLimit));
      setTerms(paymentTerms);
    }
    onOpenChange(nextOpen);
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateCustomerAction(customerId, {
          credit_limit: Number(limit) || 0,
          payment_terms: terms,
        });
        toast.success("تم حفظ إعدادات الآجل");
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error("تعذر حفظ إعدادات الآجل");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={syncFromProps}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إعدادات الآجل</DialogTitle>
          <DialogDescription>حد الائتمان وشروط الدفع لهذا العميل</DialogDescription>
        </DialogHeader>
        <div className="grid gap-[var(--mds-space-3)]">
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="credit-limit">حد الآجل</Label>
            <Input
              id="credit-limit"
              type="number"
              min="0"
              step="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <div className="space-y-[var(--mds-space-2)]">
            <Label htmlFor="payment-terms">شروط الدفع</Label>
            <Input
              id="payment-terms"
              value={terms}
              placeholder="مثال: صافي ٣٠ يوم"
              onChange={(e) => setTerms(e.target.value)}
              className="rounded-[var(--mds-radius-md)]"
            />
          </div>
          <Button
            onClick={save}
            disabled={pending}
            className="shadow-[var(--mds-elevation-1)]"
          >
            {pending ? "جاري الحفظ…" : "حفظ إعدادات الآجل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
