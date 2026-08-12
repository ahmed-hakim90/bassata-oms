"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title = "تأكيد الإجراء",
  description,
  confirmLabel = "تأكيد",
  destructive = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const [pending, setPending] = useState(false);

  async function confirmAction() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={confirmAction}
          >
            {pending ? "جارٍ التنفيذ..." : confirmLabel}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmationOptions = {
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

/** Promise-based replacement for the blocking browser confirm dialog. */
export function useConfirmationDialog() {
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [request, setRequest] = useState<
    ({ description: string } & ConfirmationOptions) | null
  >(null);

  function requestConfirmation(description: string, options: ConfirmationOptions = {}) {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setRequest({ description, ...options });
    });
  }

  function settle(confirmed: boolean) {
    resolver.current?.(confirmed);
    resolver.current = null;
    setRequest(null);
  }

  return {
    requestConfirmation,
    confirmationDialog: (
      <ConfirmationDialog
        open={request !== null}
        onOpenChange={(open) => !open && settle(false)}
        title={request?.title}
        description={request?.description ?? ""}
        confirmLabel={request?.confirmLabel}
        destructive={request?.destructive}
        onConfirm={() => settle(true)}
      />
    ),
  };
}
