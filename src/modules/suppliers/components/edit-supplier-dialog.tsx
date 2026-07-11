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
  const [form, setForm] = useState({ name: supplier.name, contact_info: supplier.contact_info });

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    startTransition(async () => {
      const result = await updateSupplierAction({
        id: supplier.id,
        name: form.name.trim(),
        contact_info: form.contact_info.trim(),
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
          setForm({ name: supplier.name, contact_info: supplier.contact_info });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>تعديل المورد</DialogTitle>
          <DialogDescription>تعديل بيانات المورد. التغييرات تُطبَّق فورًا.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>التواصل</Label>
            <Input
              value={form.contact_info}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            />
          </div>
          <Button onClick={submit} disabled={pending}>
            حفظ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
