"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleHelp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmIntent = "delete" | "danger" | "confirm";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  destructive?: boolean;
  intent?: ConfirmIntent;
  onConfirm: () => Promise<void> | void;
}

function resolveIntent(
  intent: ConfirmIntent | undefined,
  destructive: boolean,
  title: string,
  confirmLabel: string
): ConfirmIntent {
  if (intent) return intent;
  if (destructive && /حذف|delete/i.test(`${title} ${confirmLabel}`)) return "delete";
  if (destructive) return "danger";
  return "confirm";
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  pendingLabel,
  destructive = false,
  intent,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [pending, setPending] = useState(false);
  const resolvedIntent = resolveIntent(intent, destructive, title, confirmLabel);
  const isDelete = resolvedIntent === "delete";
  const isDanger = resolvedIntent !== "confirm";
  const Icon = isDelete ? Trash2 : isDanger ? AlertTriangle : CircleHelp;
  const busyLabel = pendingLabel ?? (isDelete ? "جارٍ الحذف..." : "جارٍ التنفيذ...");

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep dialog open; caller shows toast/error.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        aria-busy={pending}
        overlayClassName="bg-[var(--mds-color-bg-overlay)] supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:max-w-md",
          "max-sm:!inset-x-0 max-sm:!top-auto max-sm:!bottom-0 max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl",
          isDanger && "ring-destructive/25"
        )}
      >
        <div className="mx-auto mt-2 hidden h-1 w-10 rounded-full bg-border max-sm:block" aria-hidden />
        <div
          className={cn(
            "flex flex-col items-center px-5 pt-5 pb-5 text-center",
            isDanger && "bg-destructive/5"
          )}
        >
          <div
            className={cn(
              "mb-4 flex size-14 items-center justify-center rounded-2xl ring-1",
              isDanger
                ? "bg-destructive/10 text-destructive ring-destructive/20"
                : "bg-primary/10 text-primary ring-primary/15"
            )}
            aria-hidden
          >
            <Icon className="size-7" strokeWidth={2} />
          </div>
          <DialogHeader className="w-full items-center gap-2 pe-0 text-center">
            <DialogTitle className="text-xl leading-snug font-semibold tracking-tight text-balance">
              {title}
            </DialogTitle>
            <DialogDescription className="w-full text-sm leading-6 text-pretty">
              <span className="block">{description}</span>
              {isDelete ? (
                <span className="mt-3 block rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  لا يمكن التراجع عن هذا الإجراء
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-2xl max-sm:rounded-b-none">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? "destructive" : "default"}
            className={cn(
              "h-12 rounded-xl font-semibold",
              isDanger &&
                "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:text-white dark:hover:bg-destructive/90"
            )}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : isDelete ? (
              <Trash2 className="size-4" aria-hidden />
            ) : null}
            {pending ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
