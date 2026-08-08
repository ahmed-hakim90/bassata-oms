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
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
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

const STATUS_LABEL: Record<MonthlyClose["status"], string> = {
  draft: "مسودة",
  closed: "مقفول",
  reopened: "معاد فتحه",
};

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
          storeId: form.storeId || null,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
        });
        setDraft(closing);
        setStep("review");
        toast.success("اتعمل ملخص الفترة");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل توليد الملخص");
      }
    });
  };

  const close = () => {
    if (!draft) return;
    startTransition(async () => {
      try {
        await closePeriodAction(draft.id);
        toast.success("اتقفلت الفترة — العمليات على التواريخ دي هتتوقف");
        setStep("setup");
        setDraft(null);
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "فشل الإقفال");
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
        wasteCost?: number;
        estimatedNetProfit?: number;
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
      <OperationalCard
        title="مراجعة الملخص"
        description="اتأكد من الأرقام قبل ما تقفل الفترة"
      >
        <div className="mb-4">
          <StatusPill label={STATUS_LABEL.draft} variant="draft" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.totalRevenue ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">عدد الطلبات</p>
            <p className="text-2xl font-semibold">{summary.orderCount ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">قيمة المخزون</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.inventoryValuation ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">فرق الجلسات</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.sessionVariance ?? 0, currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">تكلفة البضاعة</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.cogs ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">المصروفات</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.totalExpenses ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">تكلفة الهالك</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.wasteCost ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">صافي تقديري</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.estimatedNetProfit ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">مجمل الربح</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.grossProfit ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">المرتجعات</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.refunds ?? 0), currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">المشتريات</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(summary.purchases ?? 0), currency)}
            </p>
          </div>
        </div>

        {summary.topWasteItem ? (
          <OperationalCard title="أعلى هالك" className="mt-4">
            <p className="font-medium">{summary.topWasteItem.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">
              {summary.topWasteItem.quantity ?? 0} وحدة ·{" "}
              {formatCurrency(Number(summary.topWasteItem.cost ?? 0), currency)}
            </p>
          </OperationalCard>
        ) : null}

        {summary.topProfitProduct ? (
          <OperationalCard title="أعلى ربح منتج" className="mt-4">
            <p className="font-medium">{summary.topProfitProduct.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">
              ربح {formatCurrency(Number(summary.topProfitProduct.profit ?? 0), currency)}
              {summary.topProfitProduct.margin != null
                ? ` · هامش ${Number(summary.topProfitProduct.margin).toFixed(0)}%`
                : ""}
            </p>
          </OperationalCard>
        ) : null}

        {expensesByCategory.length > 0 ? (
          <OperationalCard title="المصروفات حسب التصنيف (أعلى 5)" className="mt-4">
            <ul className="space-y-2 text-sm">
              {expensesByCategory.slice(0, 5).map((c, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{c.name}</span>
                  <span className="font-medium">{formatCurrency(c.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </OperationalCard>
        ) : null}

        {topExpenseCategory ? (
          <p className="mt-4 text-sm text-muted-foreground">
            أعلى تصنيف مصروف: {topExpenseCategory.name ?? "—"} —{" "}
            {formatCurrency(Number(topExpenseCategory.amount ?? 0), currency)}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setStep("setup")} disabled={pending}>
            رجوع
          </Button>
          <Button onClick={close} disabled={pending}>
            <Lock className="size-4" />
            إقفال الفترة
          </Button>
        </div>
      </OperationalCard>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <OperationalCard title="توليد ملخص الفترة">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>الفرع</Label>
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
              <Label>من</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>إلى</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={generate} disabled={pending || !form.storeId}>
            <CalendarCheck className="size-4" />
            توليد الملخص
          </Button>
        </div>
      </OperationalCard>

      {closings.length > 0 ? (
        <OperationalCard title="الإقفالات السابقة">
          <ul className="divide-y">
            {closings.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {c.period_start} → {c.period_end}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stores.find((s) => s.id === c.store_id)?.name ?? "كل الفروع"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={STATUS_LABEL[c.status]}
                    variant={
                      c.status === "closed"
                        ? "success"
                        : c.status === "reopened"
                          ? "warning"
                          : "draft"
                    }
                  />
                  {c.status === "closed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await reopenPeriodAction(c.id);
                            toast.success("اتفتحت الفترة تاني");
                            onRefresh();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "فشل إعادة الفتح");
                          }
                        });
                      }}
                    >
                      إعادة فتح
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </OperationalCard>
      ) : null}
    </div>
  );
}
