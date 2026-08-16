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

interface CustomerLegalFieldsDialogProps {
  customerId: string;
  address: string;
  taxId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerLegalFieldsDialog({
  customerId,
  address,
  taxId,
  open,
  onOpenChange,
}: CustomerLegalFieldsDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formAddress, setFormAddress] = useState(address);
  const [formTaxId, setFormTaxId] = useState(taxId);

  const syncFromProps = (nextOpen: boolean) => {
    if (nextOpen) {
      setFormAddress(address);
      setFormTaxId(taxId);
    }
    onOpenChange(nextOpen);
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateCustomerAction(customerId, {
          address: formAddress,
          tax_id: formTaxId,
        });
        toast.success("تم حفظ بيانات الفاتورة");
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error("تعذر حفظ بيانات الفاتورة");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={syncFromProps}>
      <StandardModalContent
        size="sm"
        title="بيانات الفاتورة"
        description="العنوان والرقم الضريبي يظهروا على عروض الأسعار والفواتير"
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
              {pending ? "جاري الحفظ…" : "حفظ"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="customer-legal-address">العنوان</Label>
            <Input
              id="customer-legal-address"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-legal-tax">الرقم الضريبي</Label>
            <Input
              id="customer-legal-tax"
              value={formTaxId}
              onChange={(e) => setFormTaxId(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
