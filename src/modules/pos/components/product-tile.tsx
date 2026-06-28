"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { POSProduct } from "@/modules/pos/services/catalog.service";

const BADGE_LABELS = {
  in_stock: "In stock",
  low: "Low",
  out: "Out",
  untracked: null,
} as const;

interface ProductTileProps {
  product: POSProduct;
  onAdd: () => void;
  disabled?: boolean;
}

export function ProductTile({ product, onAdd, disabled }: ProductTileProps) {
  const badgeLabel = BADGE_LABELS[product.stockBadge];
  const outOfStock = product.stockBadge === "out";

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled || outOfStock}
      className={cn(
        "group relative flex min-h-[210px] flex-col overflow-hidden rounded-2xl bg-card text-left text-card-foreground shadow-sm ring-1 ring-border transition hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[230px]"
      )}
    >
      <div
        className="relative flex aspect-[4/3] min-h-[118px] w-full items-center justify-center"
        style={{
          background: `linear-gradient(145deg, ${product.categoryColor}22, ${product.categoryColor}44)`,
        }}
      >
        <span
          className="text-5xl font-bold opacity-30"
          style={{ color: product.categoryColor }}
        >
          {product.name.charAt(0)}
        </span>
        {badgeLabel && (
          <Badge
            variant={
              product.stockBadge === "low"
                ? "outline"
                : product.stockBadge === "out"
                  ? "destructive"
                  : "secondary"
            }
            className={cn(
              "absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2.5 py-1 text-xs",
              product.stockBadge === "low" &&
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
            )}
          >
            {badgeLabel}
            {product.stockQuantity !== null && ` · ${product.stockQuantity}`}
          </Badge>
        )}
        <span className="absolute bottom-2 right-2 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-disabled:opacity-0 sm:size-12">
          <Plus className="size-5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="line-clamp-2 text-base font-semibold leading-snug text-card-foreground">
          {product.name}
        </p>
        <p className="text-sm text-muted-foreground">{product.categoryName}</p>
        <p className="mt-auto text-lg font-semibold tabular-nums text-card-foreground">
          {formatCurrency(product.base_price)}
        </p>
      </div>
    </button>
  );
}
