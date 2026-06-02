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
        toast.success("Credit settings saved");
      } catch {
        toast.error("Could not save credit settings");
      }
    });
  };

  return (
    <OperationalCard title="Credit settings">
      <div className="grid max-w-md gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Credit limit</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Payment terms</Label>
          <Input
            value={terms}
            placeholder="e.g. Net 30"
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={pending} className="sm:col-span-2">
          {pending ? "Saving…" : "Save credit settings"}
        </Button>
      </div>
    </OperationalCard>
  );
}
