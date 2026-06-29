"use client";

import type { ComponentProps, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openSessionAction } from "@/modules/sessions/actions/session.actions";
import { useTranslation } from "@/lib/i18n/use-translation";

interface OpenSessionDialogProps {
  disabled?: boolean;
  redirectTo?: string;
  triggerClassName?: string;
  triggerChildren?: ReactNode;
  triggerSize?: ComponentProps<typeof Button>["size"];
}

export function OpenSessionDialog({
  disabled,
  redirectTo,
  triggerClassName = "rounded-xl",
  triggerChildren,
  triggerSize = "default",
}: OpenSessionDialogProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cash, setCash] = useState("100");
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    const amount = parseFloat(cash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error(t("Enter a valid opening float"));
      return;
    }
    startTransition(async () => {
      try {
        await openSessionAction(amount);
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
          <div className="space-y-2">
            <Label htmlFor="opening-cash">{t("Opening cash float")}</Label>
            <Input
              id="opening-cash"
              type="number"
              min={0}
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={pending}
            onClick={handleOpen}
          >
            {pending ? t("Opening...") : t("Start session")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
