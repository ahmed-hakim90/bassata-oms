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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManagerOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultReason: string;
  confirmLabel?: string;
  onConfirm: (reason: string, pin: string) => void;
}

function ManagerOverrideDialogForm({
  onOpenChange,
  title,
  description = "المالك أو المدير يدخل PIN حسابه من المستخدمين — مش PIN الكاشير على الجهاز.",
  defaultReason,
  confirmLabel = "تأكيد الموافقة",
  onConfirm,
}: Omit<ManagerOverrideDialogProps, "open">) {
  const [reason, setReason] = useState(defaultReason);
  const [pin, setPin] = useState("");

  function handleConfirm() {
    const trimmed = reason.trim();
    const trimmedPin = pin.trim();
    if (!trimmed || trimmedPin.length < 4) return;
    onConfirm(trimmed, trimmedPin);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl max-sm:max-w-[calc(100%-0.75rem)] sm:max-w-md">
        <DialogHeader className="space-y-3 text-start">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="manager-override-pin">PIN المالك أو المدير</Label>
            <Input
              id="manager-override-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="h-12 rounded-xl text-base tracking-[0.3em]"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-override-reason">سبب الموافقة</Label>
            <Textarea
              id="manager-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="min-h-24 resize-none rounded-xl text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            className="h-12 rounded-xl font-semibold"
            onClick={handleConfirm}
            disabled={!reason.trim() || pin.trim().length < 4}
          >
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