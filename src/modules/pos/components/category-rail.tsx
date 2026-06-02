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
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "min-h-11 shrink-0 rounded-full px-5 text-sm font-medium transition sm:text-base",
          selectedId === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-muted"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
        type="button"
        onClick={() => onSelect(cat.id)}
        className={cn(
            "min-h-11 shrink-0 rounded-full px-5 text-sm font-medium transition sm:text-base",
            selectedId === cat.id
              ? "text-white shadow-sm"
              : "bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-muted"
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
