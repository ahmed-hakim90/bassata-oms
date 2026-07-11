"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CostCenter, ExpenseCategory } from "@/lib/types";
import { EXPENSE_SOURCES, EXPENSE_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SOURCE_LABELS: Record<string, string> = {
  session_cash: "نقدية الجلسة",
  external: "خارجي",
  purchase: "شراء",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الموافقة",
  approved: "معتمد",
};

interface ExpenseFiltersBarProps {
  costCenters: CostCenter[];
  categories: ExpenseCategory[];
  values: {
    costCenterId: string;
    categoryId: string;
    source: string;
    status: string;
    from: string;
    to: string;
  };
}

export function ExpenseFiltersBar({ costCenters, categories, values }: ExpenseFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/expenses?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">مركز التكلفة</label>
        <select
          value={values.costCenterId}
          onChange={(e) => apply({ costCenterId: e.target.value, categoryId: "" })}
          className="flex h-9 min-w-[140px] rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">التصنيف</label>
        <select
          value={values.categoryId}
          onChange={(e) => apply({ categoryId: e.target.value })}
          className="flex h-9 min-w-[140px] rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {categories
            .filter((c) => !values.costCenterId || c.cost_center_id === values.costCenterId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">المصدر</label>
        <select
          value={values.source}
          onChange={(e) => apply({ source: e.target.value })}
          className="flex h-9 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {EXPENSE_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">الحالة</label>
        <select
          value={values.status}
          onChange={(e) => apply({ status: e.target.value })}
          className="flex h-9 rounded-[var(--mds-radius-md)] border border-input bg-background px-[var(--mds-space-3)] text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">الكل</option>
          {EXPENSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">من</label>
        <Input
          type="date"
          value={values.from}
          onChange={(e) => apply({ from: e.target.value })}
          className="h-9 rounded-[var(--mds-radius-md)]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">إلى</label>
        <Input
          type="date"
          value={values.to}
          onChange={(e) => apply({ to: e.target.value })}
          className="h-9 rounded-[var(--mds-radius-md)]"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/expenses")}
      >
        مسح الفلاتر
      </Button>
    </div>
  );
}
