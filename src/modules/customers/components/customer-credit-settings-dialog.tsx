"use client";

import { useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
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
      <StandardModalContent
        size="sm"
        title="إعدادات الآجل"
        description="حد الائتمان وشروط الدفع لهذا العميل"
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
              onClick={save}
              disabled={pending}
            >
              {pending ? "جاري الحفظ…" : "حفظ إعدادات الآجل"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="credit-limit">حد الآجل</Label>
            <Input
              id="credit-limit"
              type="number"
              min="0"
              step="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-terms">شروط الدفع</Label>
            <Input
              id="payment-terms"
              value={terms}
              placeholder="مثال: صافي ٣٠ يوم"
              onChange={(e) => setTerms(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
