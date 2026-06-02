"use client";

import { Layers } from "lucide-react";
import type { Category } from "@/lib/types";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { Button } from "@/components/ui/button";
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
  return (
    <GlassPanel className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 px-2 py-1">
        <Layers className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </span>
      </div>

      <Button
        variant={selectedId === null ? "secondary" : "ghost"}
        className="justify-between"
        onClick={() => onSelect(null)}
      >
        All products
        <span className="text-xs tabular-nums text-muted-foreground">
          {Object.values(counts).reduce((a, b) => a + b, 0)}
        </span>
      </Button>

      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedId === category.id ? "secondary" : "ghost"}
          className="justify-between gap-2"
          onClick={() => onSelect(category.id)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn("size-2.5 shrink-0 rounded-full")}
              style={{ backgroundColor: category.color }}
            />
            <span className="truncate">{category.name}</span>
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {counts[category.id] ?? 0}
          </span>
        </Button>
      ))}
    </GlassPanel>
  );
}
