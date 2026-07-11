"use client";

import { Layers } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryListProps {
  categories: Category[];
  selectedId: string | null;
  counts: Record<string, number>;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryList({
  categories,
  selectedId,
  counts,
  onSelect,
}: CategoryListProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <aside className="flex h-fit flex-col gap-1 rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-2)] shadow-[var(--mds-elevation-1)] lg:sticky lg:top-2">
      <div className="flex items-center gap-2 px-[var(--mds-space-2)] py-[var(--mds-space-2)]">
        <Layers className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
          التصنيفات
        </span>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[var(--mds-radius-md)] px-3 py-2 text-sm transition-colors",
          selectedId === null
            ? "bg-primary/10 font-semibold text-primary"
            : "text-foreground hover:bg-muted/70"
        )}
        aria-current={selectedId === null ? "true" : undefined}
      >
        <span>كل المنتجات</span>
        <span className="tabular-nums text-xs text-muted-foreground">{total}</span>
      </button>

      <div className="max-h-[min(28rem,55vh)] space-y-0.5 overflow-y-auto pe-0.5">
        {categories.map((category) => {
          const active = selectedId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-[var(--mds-radius-md)] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-foreground hover:bg-muted/70"
              )}
              aria-current={active ? "true" : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="truncate">{category.name}</span>
              </span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {counts[category.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
