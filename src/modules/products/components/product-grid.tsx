"use client";

import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProductGridItem {
  product: Product;
  category: Category | null;
  hasRecipe?: boolean;
  variantCount?: number;
}

interface ProductGridProps {
  items: ProductGridItem[];
  currency?: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductGrid({
  items,
  currency = "USD",
  onEdit,
  onDelete,
}: ProductGridProps) {
  if (items.length === 0) {
    return (
      <GlassPanel className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No products match your filters.</p>
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map(({ product, category, hasRecipe, variantCount = 0 }) => (
        <GlassPanel
          key={product.id}
          className={cn(
            "group flex flex-col overflow-hidden p-0",
            !product.is_active && "opacity-70"
          )}
        >
          <div
            className="flex h-24 items-end justify-between p-4"
            style={{
              background: `linear-gradient(135deg, ${category?.color ?? "#94A3B8"}33, transparent)`,
            }}
          >
            <div
              className="flex size-12 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: category?.color ?? "#64748B" }}
            >
              <Package className="size-5" />
            </div>
            <div className="flex flex-col items-end gap-1">
              {variantCount > 0 ? (
                <StatusPill label={`${variantCount} sizes`} variant="info" />
              ) : null}
              {hasRecipe ? <StatusPill label="Recipe" variant="info" /> : null}
              {product.product_type === "ingredient" ? (
                <StatusPill label="Ingredient" variant="default" />
              ) : null}
              {product.is_popular ? (
                <StatusPill label="Popular" variant="info" />
              ) : null}
              {!product.is_active ? (
                <StatusPill label="Inactive" variant="default" />
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {category?.name ?? "Uncategorized"}
              </p>
              <h3 className="font-semibold leading-tight">{product.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {product.sku} · {product.barcode}
              </p>
            </div>

            <div className="mt-auto flex items-end justify-between gap-2">
              <p className="text-xl font-semibold tabular-nums">
                {formatCurrency(product.base_price, currency)}
              </p>
              {product.track_inventory ? (
                <StatusPill label="Tracked" variant="success" />
              ) : (
                <StatusPill label="No track" variant="default" />
              )}
            </div>

            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(product)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => onDelete(product)}
              >
                Remove
              </Button>
            </div>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
