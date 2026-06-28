"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { closeSessionAction } from "@/modules/sessions/actions/session.actions";
import type { SessionReconciliation } from "@/modules/sessions/services/reconciliation.service";
import type { CashierSession, Expense } from "@/lib/types";

const STEPS = [
  "Summary",
  "Expenses",
  "Expected",
  "Actual",
  "Variance",
  "Confirm",
] as const;

interface CloseSessionStepperProps {
  session: CashierSession;
  reconciliation: SessionReconciliation;
  sessionExpenses: Expense[];
  cashierName: string;
  costCenterMap?: Map<string, string>;
  categoryMap?: Map<string, string>;
}

export function CloseSessionStepper({
  session,
  reconciliation,
  sessionExpenses,
  cashierName,
  costCenterMap = new Map(),
  categoryMap = new Map(),
}: CloseSessionStepperProps) {
  const [step, setStep] = useState(0);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const actual = parseFloat(actualCash) || 0;
  const variance = useMemo(
    () => actual - reconciliation.expectedCash,
    [actual, reconciliation.expectedCash]
  );

  function handleClose() {
    startTransition(async () => {
      try {
        await closeSessionAction({
          sessionId: session.id,
          actualCash: actual,
          notes: notes || undefined,
        });
        toast.success("Session closed");
        window.location.reload();
      } catch {
        toast.error("Could not close session");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-border">
      <div className="mb-6 flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              i <= step ? "bg-primary" : "bg-muted"
            )}
            title={label}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Session summary</h3>
          <p className="text-sm text-muted-foreground">Cashier: {cashierName}</p>
          <p className="text-sm text-muted-foreground">
            Opened {new Date(session.opened_at).toLocaleString()}
          </p>
          <p className="text-sm">
            Opening float: {formatCurrency(session.opening_cash)}
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Session expenses</h3>
          {sessionExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded</p>
          ) : (
            <ul className="space-y-2">
              {sessionExpenses.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{e.title}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(e.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {costCenterMap.get(e.cost_center_id) ?? "—"} ·{" "}
                    {categoryMap.get(e.expense_category_id) ?? "—"} ·{" "}
                    {e.expense_source.replace("_", " ")}
                    {e.inventory_item_id && e.quantity != null && e.unit_cost != null
                      ? ` · ${e.quantity} × ${formatCurrency(e.unit_cost)}`
                      : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm font-medium">
            Total expenses: {formatCurrency(reconciliation.expenses)}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Expected cash</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Opening</dt>
              <dd>{formatCurrency(reconciliation.openingCash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cash sales</dt>
              <dd>+{formatCurrency(reconciliation.cashSales)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expenses</dt>
              <dd>-{formatCurrency(reconciliation.expenses)}</dd>
            </div>
          </dl>
          <p className="text-2xl font-bold tabular-nums">
            {formatCurrency(reconciliation.expectedCash)}
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-semibold">Count actual cash</h3>
          <div className="space-y-2">
            <Label htmlFor="actual-cash">Amount in drawer</Label>
            <Input
              id="actual-cash"
              type="number"
              min={0}
              step="0.01"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              className="h-12 rounded-xl text-lg"
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-semibold">Variance</h3>
          <p className="text-sm text-muted-foreground">
            Expected {formatCurrency(reconciliation.expectedCash)} · Actual{" "}
            {formatCurrency(actual)}
          </p>
          <p
            className={cn(
              "text-3xl font-bold tabular-nums",
              variance === 0
                ? "text-emerald-600"
                : variance > 0
                  ? "text-amber-600"
                  : "text-destructive"
            )}
          >
            {variance >= 0 ? "+" : ""}
            {formatCurrency(variance)}
          </p>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-semibold">Confirm close</h3>
          <p className="text-sm text-muted-foreground">
            This will close the session and lock the register totals.
          </p>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={3}
            />
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            className="rounded-xl"
            disabled={step === 3 && !actualCash}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            className="rounded-xl"
            disabled={pending}
            onClick={handleClose}
          >
            {pending ? "Closing…" : "Close session"}
          </Button>
        )}
      </div>
    </div>
  );
}
