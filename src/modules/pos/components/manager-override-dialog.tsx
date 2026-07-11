"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManagerOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultReason: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
}

function ManagerOverrideDialogForm({
  onOpenChange,
  title,
  description = "سجّل سبب موافقة المدير للمتابعة.",
  defaultReason,
  confirmLabel = "تأكيد الموافقة",
  onConfirm,
}: Omit<ManagerOverrideDialogProps, "open">) {
  const [reason, setReason] = useState(defaultReason);

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl sm:max-w-md">
        <DialogHeader className="space-y-3 text-start">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="manager-override-reason">سبب الموافقة</Label>
          <Textarea
            id="manager-override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none rounded-xl"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleConfirm} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Remount when opened so defaultReason resets without an effect. */
export function ManagerOverrideDialog(props: ManagerOverrideDialogProps) {
  if (!props.open) return null;
  return <ManagerOverrideDialogForm key={props.defaultReason} {...props} />;
}
