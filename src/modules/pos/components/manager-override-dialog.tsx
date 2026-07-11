"use client";

import { useEffect, useState } from "react";
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

export function ManagerOverrideDialog({
  open,
  onOpenChange,
  title,
  description = "سجّل سبب موافقة المدير للمتابعة.",
  defaultReason,
  confirmLabel = "تأكيد الموافقة",
  onConfirm,
}: ManagerOverrideDialogProps) {
  const [reason, setReason] = useState(defaultReason);

  useEffect(() => {
    if (open) setReason(defaultReason);
  }, [open, defaultReason]);

  function handleOpenChange(next: boolean) {
    if (next) setReason(defaultReason);
    onOpenChange(next);
  }

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl sm:max-w-md">
        <DialogHeader className="space-y-3 text-start">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
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
            className="rounded-xl"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" disabled={!reason.trim()} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
