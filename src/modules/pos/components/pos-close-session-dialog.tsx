"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CloseSessionStepper } from "@/modules/sessions/components/close-session-stepper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import type { CashierSession, Expense } from "@/lib/types";

interface PosCloseSessionDialogProps {
  session: CashierSession;
  reconciliation: SessionReconciliation;
  sessionExpenses: Expense[];
  cashierName: string;
  costCenterMap?: Record<string, string>;
  categoryMap?: Record<string, string>;
  triggerChildren?: ReactNode;
  triggerClassName?: string;
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerVariant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
}

export function PosCloseSessionDialog({
  session,
  reconciliation,
  sessionExpenses,
  cashierName,
  costCenterMap,
  categoryMap,
  triggerChildren,
  triggerClassName = "rounded-full",
  triggerSize = "sm",
  triggerVariant = "outline",
}: PosCloseSessionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerChildren ?? "إغلاق الجلسة"}
      </Button>
      <DialogContent className="max-h-[92dvh] max-w-[min(720px,calc(100%-1rem))] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>إغلاق جلسة الكاشير</DialogTitle>
        </DialogHeader>
        <CloseSessionStepper
          session={session}
          reconciliation={reconciliation}
          sessionExpenses={sessionExpenses}
          cashierName={cashierName}
          costCenterMap={costCenterMap}
          categoryMap={categoryMap}
        />
      </DialogContent>
    </Dialog>
  );
}
