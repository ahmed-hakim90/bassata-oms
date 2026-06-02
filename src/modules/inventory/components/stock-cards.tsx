"use client";

import { Boxes } from "lucide-react";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatUnit } from "@/lib/units";
import type { Category } from "@/lib/types";
import type { StockLevelView } from "../services/stock.service";
import { cn } from "@/lib/utils";

export interface StockCategoryGroup {
  category: Category;
  items: StockLevelView[];
  totalQty: number;
  lowCount: number;
}

interface StockCardsProps {
  groups: StockCategoryGroup[];
}

export function StockCards({ groups }: StockCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
      {groups.map(({ category, items, totalQty, lowCount }) => (
        <GlassPanel key={category.id} className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex size-11 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: category.color }}
              >
                <Boxes className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {items.length} SKUs · {totalQty} units on hand
                </p>
              </div>
            </div>
            {lowCount > 0 ? (
              <StatusPill label={`${lowCount} low`} variant="warning" />
            ) : (
              <StatusPill label="OK" variant="success" />
            )}
          </div>

          <div className="grid gap-2">
            {items.slice(0, 5).map((item) => {
              const isLow = item.quantity <= item.reorder_point;
              const pct = Math.min(
                100,
                (item.quantity / Math.max(item.reorder_point, 1)) * 100
              );
              return (
                <div key={item.id} className="grid gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium">{item.product.name}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        isLow && "font-semibold text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {item.quantity} {formatUnit(item.product.unit)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isLow ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {items.length > 5 ? (
              <p className="text-xs text-muted-foreground">+{items.length - 5} more items</p>
            ) : null}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
