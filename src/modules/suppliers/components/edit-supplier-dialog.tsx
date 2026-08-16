"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import type { Supplier } from "@/lib/types";
import { updateSupplierAction } from "@/modules/suppliers/actions/supplier.actions";

interface EditSupplierDialogProps {
  supplier: Supplier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (supplier: Supplier) => void;
}

export function EditSupplierDialog({
  supplier,
  open,
  onOpenChange,
  onSuccess,
}: EditSupplierDialogProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: supplier.name,
    contact_info: supplier.contact_info,
    opening_balance: String(supplier.opening_balance ?? 0),
    address: supplier.address ?? "",
    tax_id: supplier.tax_id ?? "",
  });

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const opening = parseFloat(form.opening_balance);
    if (!Number.isFinite(opening) || opening < 0) {
      toast.error("رصيد مستحق سابق لازم يكون صفر أو أكبر");
      return;
    }
    startTransition(async () => {
      const result = await updateSupplierAction({
        id: supplier.id,
        name: form.name.trim(),
        contact_info: form.contact_info.trim(),
        opening_balance: opening,
        address: form.address.trim(),
        tax_id: form.tax_id.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم تحديث المورد");
      onSuccess(result.data);
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setForm({
            name: supplier.name,
            contact_info: supplier.contact_info,
            opening_balance: String(supplier.opening_balance ?? 0),
            address: supplier.address ?? "",
            tax_id: supplier.tax_id ?? "",
          });
        }
        onOpenChange(next);
      }}
    >
      <StandardModalContent
        size="sm"
        title="تعديل المورد"
        description="تعديل بيانات المورد. التغييرات تُطبَّق فورًا."
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
              disabled={pending}
            >
              حفظ
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>التواصل</Label>
            <Input
              className="h-11"
              value={form.contact_info}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input
              className="h-11"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>الرقم الضريبي</Label>
            <Input
              className="h-11"
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>رصيد مستحق سابق</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-11"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              المبلغ المستحق على المحل قبل أي فواتير في النظام.
            </p>
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
