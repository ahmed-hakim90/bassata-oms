"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPendingOpeningFloatAction,
  openSessionAction,
} from "@/modules/sessions/actions/session.actions";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";

interface OpenSessionDialogProps {
  disabled?: boolean;
  redirectTo?: string;
  triggerClassName?: string;
  triggerChildren?: ReactNode;
  triggerSize?: ComponentProps<typeof Button>["size"];
  /** When true (cashier POS / locked mode), opening float is read-only from vault pending. */
  lockOpeningFloat?: boolean;
  canEditOpeningFloat?: boolean;
}

export function OpenSessionDialog({
  disabled,
  redirectTo,
  triggerClassName = "rounded-xl",
  triggerChildren,
  triggerSize = "default",
  lockOpeningFloat = false,
  canEditOpeningFloat = true,
}: OpenSessionDialogProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("0");
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [pendingFloat, setPendingFloat] = useState<number | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [pending, startTransition] = useTransition();

  const floatLocked = lockOpeningFloat || !canEditOpeningFloat;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingVault(true);
    getPendingOpeningFloatAction()
      .then((result) => {
        if (cancelled) return;
        setPendingFloat(result.pendingOpeningFloat);
        setVaultBalance(result.vaultBalance);
        setCash(String(result.pendingOpeningFloat));
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "تعذر قراءة خزينة الكاشير");
      })
      .finally(() => {
        if (!cancelled) setLoadingVault(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleOpen() {
    const amount = parseFloat(cash);
    if (!floatLocked && (Number.isNaN(amount) || amount < 0)) {
      toast.error(t("Enter a valid opening float"));
      return;
    }
    startTransition(async () => {
      try {
        await openSessionAction(floatLocked ? null : amount);
        toast.success(t("Session opened"));
        setOpen(false);
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        } else {
          window.location.reload();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Could not open session"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={triggerSize}
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {triggerChildren ?? t("Open session")}
      </Button>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Open cashier session")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {vaultBalance != null ? (
            <p className="text-sm text-muted-foreground">
              رصيد الخزينة:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(vaultBalance)}
              </span>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="opening-cash">{t("Opening cash float")}</Label>
            <Input
              id="opening-cash"
              type="number"
              min={0}
              step="0.01"
              value={cash}
              readOnly={floatLocked || loadingVault}
              disabled={floatLocked || loadingVault}
              onChange={(e) => setCash(e.target.value)}
              className="rounded-xl"
            />
            {floatLocked ? (
              <p className="text-xs text-muted-foreground">
                رصيد بداية الوردية متقفّل من الإدارة
                {pendingFloat != null ? ` (${formatCurrency(pendingFloat)})` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                المبلغ بيتسحب من خزينة الكاشير للدرج — لازم يكون متاح في الخزينة
              </p>
            )}
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={pending || loadingVault}
            onClick={handleOpen}
          >
            {pending ? t("Opening...") : t("Start session")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
