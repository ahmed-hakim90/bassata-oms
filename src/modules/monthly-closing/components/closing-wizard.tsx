"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
import type { MonthlyClose, Store } from "@/lib/types";
import {
  closePeriodAction,
  generateClosingAction,
  reopenPeriodAction,
} from "@/modules/monthly-closing/actions/closing.actions";

interface ClosingWizardProps {
  closings: MonthlyClose[];
  stores: Store[];
  currency: string;
  defaultStoreId: string;
  onRefresh: () => void;
}

export function ClosingWizard({
  closings,
  stores,
  currency,
  defaultStoreId,
  onRefresh,
}: ClosingWizardProps) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"setup" | "review">("setup");
  const [draft, setDraft] = useState<MonthlyClose | null>(null);
  const [form, setForm] = useState({
    storeId: defaultStoreId,
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
  });

  const generate = () => {
    startTransition(async () => {
      try {
        const closing = await generateClosingAction({
          storeId: form.storeId,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
        });
        setDraft(closing);
        setStep("review");
        toast.success("Snapshot generated");
      } catch {
        toast.error("Failed to generate");
      }
    });
  };

  const close = () => {
    if (!draft) return;
    startTransition(async () => {
      try {
        await closePeriodAction(draft.id);
        toast.success("Period closed");
        setStep("setup");
        setDraft(null);
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const summary = draft?.summary as
    | (Record<string, unknown> & {
        totalRevenue?: number;
        orderCount?: number;
        inventoryValuation?: number;
        sessionVariance?: number;
        cogs?: number;
        totalExpenses?: number;
        topExpenseCategory?: { name?: string; amount?: number } | null;
        expensesByCategory?: { name: string; amount: number }[];
        topWasteItem?: { name?: string; quantity?: number; cost?: number } | null;
        topProfitProduct?: { name?: string; profit?: number; margin?: number } | null;
        grossProfit?: number;
        refunds?: number;
        purchases?: number;
      })
    | undefined;
  const topExpenseCategory = summary?.topExpenseCategory;
  const expensesByCategory = summary?.expensesByCategory ?? [];

  if (step === "review" && draft && summary) {
    return (
      <OperationalCard title="Review Snapshot" description="Confirm before closing period">
        <div className="mb-4">
          <StatusPill label="draft" variant="draft" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.totalRevenue ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="text-2xl font-semibold">{summary.orderCount ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Inventory Value</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.inventoryValuation ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Session Variance</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.sessionVariance ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">COGS</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.cogs ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.totalExpenses ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Waste Cost</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.wasteCost ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Est. Net Profit</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.estimatedNetProfit ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Gross Profit</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.grossProfit ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Refunds</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.refunds ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Purchases</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.purchases ?? 0), currency)}
            </p>
          </div>
        </div>

        {summary.topWasteItem && (
          <OperationalCard title="Top Waste Item" className="mt-4">
            <p className="font-medium">{summary.topWasteItem.name ?? "Unknown"}</p>
            <p className="text-sm text-muted-foreground">
              {summary.topWasteItem.quantity ?? 0} units ·{" "}
              {formatCurrency(Number(summary.topWasteItem.cost ?? 0), currency)}
            </p>
          </OperationalCard>
        )}

        {summary.topProfitProduct && (
          <OperationalCard title="Top Profit Product" className="mt-4">
            <p className="font-medium">{summary.topProfitProduct.name ?? "Unknown"}</p>
            <p className="text-sm text-muted-foreground">
              Profit {formatCurrency(Number(summary.topProfitProduct.profit ?? 0), currency)}
              {summary.topProfitProduct.margin != null
                ? ` · ${Number(summary.topProfitProduct.margin).toFixed(0)}% margin`
                : ""}
            </p>
          </OperationalCard>
        )}

        {expensesByCategory.length > 0 && (
          <OperationalCard title="Expenses by Category (top 5)" className="mt-4">
            <ul className="space-y-2 text-sm">
              {expensesByCategory.slice(0, 5).map((c, i) => (
                <li key={i} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="font-medium">{formatCurrency(c.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </OperationalCard>
        )}

        {topExpenseCategory && (
          <p className="mt-4 text-sm text-muted-foreground">
            Top expense category:{" "}
            {topExpenseCategory.name ?? "Unknown"} —{" "}
            {formatCurrency(Number(topExpenseCategory.amount ?? 0), currency)}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={() => setStep("setup")}>
            Back
          </Button>
          <Button onClick={close} disabled={pending}>
            <Lock className="size-4" /> Close Period
          </Button>
        </div>
      </OperationalCard>
    );
  }

  return (
    <div className="space-y-6">
      <OperationalCard title="Generate Snapshot">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>Store</Label>
            <Select
              value={form.storeId}
              onValueChange={(v) => setForm({ ...form, storeId: v ?? "" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) =>
                  setForm({ ...form, periodStart: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) =>
                  setForm({ ...form, periodEnd: e.target.value })
                }
              />
            </div>
          </div>
          <Button onClick={generate} disabled={pending}>
            <CalendarCheck className="size-4" /> Generate Snapshot
          </Button>
        </div>
      </OperationalCard>

      {closings.length > 0 && (
        <OperationalCard title="Past Closings">
          <ul className="divide-y">
            {closings.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {c.period_start} → {c.period_end}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stores.find((s) => s.id === c.store_id)?.name ?? "All stores"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={c.status}
                    variant={
                      c.status === "closed"
                        ? "success"
                        : c.status === "reopened"
                          ? "warning"
                          : "draft"
                    }
                  />
                  {c.status === "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await reopenPeriodAction(c.id);
                            toast.success("Period reopened");
                            onRefresh();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed"
                            );
                          }
                        });
                      }}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </OperationalCard>
      )}
    </div>
  );
}
