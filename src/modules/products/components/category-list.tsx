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
    <>
      <div className="min-w-0 lg:hidden">
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <Layers className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
            التصنيفات
          </span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch]">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
              selectedId === null
                ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/70"
            )}
            aria-current={selectedId === null ? "true" : undefined}
          >
            <span>الكل</span>
            <span className="tabular-nums text-xs text-muted-foreground">{total}</span>
          </button>
          {categories.map((category) => {
            const active = selectedId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                className={cn(
                  "inline-flex h-10 max-w-[12rem] shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted/70"
                )}
                aria-current={active ? "true" : undefined}
                title={category.name}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="truncate">{category.name}</span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {counts[category.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="hidden h-fit flex-col gap-1 rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-2)] shadow-[var(--mds-elevation-1)] lg:sticky lg:top-2 lg:flex">
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
    </>
  );
}
