"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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

type SessionCashResponse = {
  reconciliation: SessionReconciliation;
  expenses: Expense[];
  error?: string;
};

export function PosCloseSessionDialog({
  session,
  reconciliation: initialReconciliation,
  sessionExpenses: initialExpenses,
  cashierName,
  costCenterMap,
  categoryMap,
  triggerChildren,
  triggerClassName = "rounded-full",
  triggerSize = "sm",
  triggerVariant = "outline",
}: PosCloseSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconciliation, setReconciliation] =
    useState<SessionReconciliation>(initialReconciliation);
  const [sessionExpenses, setSessionExpenses] = useState<Expense[]>(initialExpenses);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/pos/session-cash", { cache: "no-store" });
        const body = (await res.json()) as SessionCashResponse;
        if (!res.ok) {
          throw new Error(body.error ?? "تعذر تحميل ملخص الجلسة");
        }
        if (cancelled) return;
        setReconciliation(body.reconciliation);
        setSessionExpenses(body.expenses ?? []);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "تعذر تحميل ملخص الجلسة");
        setReconciliation(initialReconciliation);
        setSessionExpenses(initialExpenses);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialReconciliation, initialExpenses]);

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
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            جاري تحميل ملخص المبيعات…
          </p>
        ) : (
          <>
            {loadError ? (
              <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                {loadError} — معروض آخر ملخص محفوظ على الشاشة.
              </p>
            ) : null}
            <CloseSessionStepper
              session={session}
              reconciliation={reconciliation}
              sessionExpenses={sessionExpenses}
              cashierName={cashierName}
              costCenterMap={costCenterMap}
              categoryMap={categoryMap}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
