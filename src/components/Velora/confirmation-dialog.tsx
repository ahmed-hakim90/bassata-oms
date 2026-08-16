"use client";

import { useRef, useState } from "react";
import {
  ConfirmActionDialog,
  type ConfirmIntent,
} from "@/components/Velora/confirm-action-dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  intent?: ConfirmIntent;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title = "تأكيد الإجراء",
  description,
  confirmLabel = "تأكيد",
  destructive = false,
  intent,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      intent={intent}
      onConfirm={onConfirm}
    />
  );
}

type ConfirmationOptions = {
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  intent?: ConfirmIntent;
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
        intent={request?.intent}
        onConfirm={() => settle(true)}
      />
    ),
  };
}
