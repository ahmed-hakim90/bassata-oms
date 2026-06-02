"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CostCenter, ExpenseCategory } from "@/lib/types";
import { EXPENSE_SOURCES, EXPENSE_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-muted/30 p-4">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Cost center</label>
        <select
          value={values.costCenterId}
          onChange={(e) => apply({ costCenterId: e.target.value, categoryId: "" })}
          className="flex h-9 min-w-[140px] rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Category</label>
        <select
          value={values.categoryId}
          onChange={(e) => apply({ categoryId: e.target.value })}
          className="flex h-9 min-w-[140px] rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All</option>
          {categories
            .filter((c) => !values.costCenterId || c.cost_center_id === values.costCenterId)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Source</label>
        <select
          value={values.source}
          onChange={(e) => apply({ source: e.target.value })}
          className="flex h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All</option>
          {EXPENSE_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          value={values.status}
          onChange={(e) => apply({ status: e.target.value })}
          className="flex h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All</option>
          {EXPENSE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">From</label>
        <Input type="date" value={values.from} onChange={(e) => apply({ from: e.target.value })} className="h-9 rounded-xl" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">To</label>
        <Input type="date" value={values.to} onChange={(e) => apply({ to: e.target.value })} className="h-9 rounded-xl" />
      </div>
      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => router.push("/expenses")}>
        Clear
      </Button>
    </div>
  );
}
