"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateCustomerAction } from "@/modules/customers/actions/customer.actions";

interface CustomerCreditSettingsProps {
  customerId: string;
  creditLimit: number;
  paymentTerms: string;
  canEdit: boolean;
}

export function CustomerCreditSettings({
  customerId,
  creditLimit,
  paymentTerms,
  canEdit,
}: CustomerCreditSettingsProps) {
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState(String(creditLimit));
  const [terms, setTerms] = useState(paymentTerms);

  if (!canEdit) return null;

  const save = () => {
    startTransition(async () => {
      try {
        await updateCustomerAction(customerId, {
          credit_limit: Number(limit) || 0,
          payment_terms: terms,
        });
        toast.success("تم حفظ إعدادات الآجل");
      } catch {
        toast.error("تعذر حفظ إعدادات الآجل");
      }
    });
  };

  return (
    <OperationalCard title="إعدادات الآجل">
      <div className="grid max-w-md gap-[var(--mds-space-3)] sm:grid-cols-2">
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
        <div className="space-y-[var(--mds-space-2)] sm:col-span-2">
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
          className="shadow-[var(--mds-elevation-1)] sm:col-span-2"
        >
          {pending ? "جاري الحفظ…" : "حفظ إعدادات الآجل"}
        </Button>
      </div>
    </OperationalCard>
  );
}
