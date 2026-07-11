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

const STEPS = ["الملخص", "العدّ والتأكيد"] as const;

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
    if (actualCash.trim() === "") return;
    const confirmed = window.confirm(
      [
        "سيتم إغلاق الجلسة وتثبيت إجماليات الكاشير.",
        "",
        `المتوقع: ${formatCurrency(reconciliation.expectedCash)}`,
        `الفعلي: ${formatCurrency(actual)}`,
        `الفرق: ${variance >= 0 ? "+" : ""}${formatCurrency(variance)}`,
        "",
        "هل تريد المتابعة؟",
      ].join("\n")
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await closeSessionAction({
          sessionId: session.id,
          actualCash: actual,
          notes: notes || undefined,
        });
        toast.success("تم إغلاق الجلسة");
        window.location.reload();
      } catch {
        toast.error("تعذر إغلاق الجلسة");
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
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-heading text-lg font-semibold">ملخص الجلسة</h3>
            <p className="text-sm text-muted-foreground">الكاشير: {cashierName}</p>
            <p className="text-sm text-muted-foreground">
              تم الفتح {new Date(session.opened_at).toLocaleString()}
            </p>
          </div>

          <dl className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">رصيد الافتتاح</dt>
              <dd className="tabular-nums">{formatCurrency(reconciliation.openingCash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">مبيعات نقدية</dt>
              <dd className="tabular-nums">+{formatCurrency(reconciliation.cashSales)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">المصروفات</dt>
              <dd className="tabular-nums">-{formatCurrency(reconciliation.expenses)}</dd>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
              <dt>المتوقع في الدرج</dt>
              <dd className="tabular-nums">{formatCurrency(reconciliation.expectedCash)}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <p className="text-sm font-medium">مصروفات الجلسة</p>
            {sessionExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مصروفات مسجلة</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
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
                      {categoryMap.get(e.expense_category_id) ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-semibold">عدّ النقدية وتأكيد الإغلاق</h3>
          <p className="text-sm text-muted-foreground">
            المتوقع {formatCurrency(reconciliation.expectedCash)}
          </p>
          <div className="space-y-2">
            <Label htmlFor="actual-cash">المبلغ في الدرج</Label>
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
          {actualCash ? (
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                variance === 0
                  ? "text-emerald-600"
                  : variance > 0
                    ? "text-amber-600"
                    : "text-destructive"
              )}
            >
              الفرق: {variance >= 0 ? "+" : ""}
              {formatCurrency(variance)}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
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
          رجوع
        </Button>
        {step < STEPS.length - 1 ? (
          <Button className="rounded-xl" onClick={() => setStep(1)}>
            متابعة للعدّ
          </Button>
        ) : (
          <Button
            className="rounded-xl"
            disabled={pending || actualCash.trim() === ""}
            onClick={handleClose}
          >
            {pending ? "جاري الإغلاق…" : "إغلاق الجلسة"}
          </Button>
        )}
      </div>
    </div>
  );
}
