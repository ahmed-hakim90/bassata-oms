"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

interface CategoryRailProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryRail({
  categories,
  selectedId,
  onSelect,
}: CategoryRailProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto overscroll-x-contain scroll-ps-1 pb-1 [-webkit-overflow-scrolling:touch] scrollbar-none max-[390px]:gap-1"
      role="tablist"
      aria-label="تصنيفات المنتجات"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedId === null}
        onClick={() => onSelect(null)}
        className={cn(
          "min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-[390px]:px-3 max-[390px]:text-xs sm:px-5 sm:text-base",
          selectedId === null
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "bg-card text-muted-foreground ring-1 ring-border/70 hover:bg-muted/80 hover:text-foreground"
        )}
      >
        الكل
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          role="tab"
          aria-selected={selectedId === cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 max-[390px]:px-3 max-[390px]:text-xs sm:px-5 sm:text-base",
            selectedId === cat.id
              ? "font-semibold text-white shadow-sm"
              : "bg-card text-muted-foreground ring-1 ring-border/70 hover:bg-muted/80 hover:text-foreground"
          )}
          style={
            selectedId === cat.id
              ? { backgroundColor: cat.color }
              : undefined
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
