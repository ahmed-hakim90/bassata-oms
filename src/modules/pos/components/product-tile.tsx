"use client";

import Image from "next/image";
import { Layers3, Plus } from "lucide-react";
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
  const variantPrices = product.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);
  const minVariantPrice = variantPrices[0];
  const maxVariantPrice = variantPrices.at(-1);
  const showVariantPrice =
    product.hasVariants && minVariantPrice != null && maxVariantPrice != null;
  const displayPrice = showVariantPrice ? minVariantPrice : product.base_price;
  const priceRange =
    showVariantPrice && maxVariantPrice > minVariantPrice
      ? ` إلى ${formatCurrency(maxVariantPrice)}`
      : "";

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled || outOfStock}
      className={cn(
        "group relative flex min-h-[218px] flex-col overflow-hidden rounded-3xl bg-card text-left text-card-foreground shadow-sm ring-1 ring-border/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[238px]"
      )}
    >
      <div
        className="relative flex aspect-[4/3] min-h-[122px] w-full items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${product.categoryColor}22, ${product.categoryColor}44)`,
        }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        {product.image_url ? (
          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
        ) : null}
        <span
          className={cn(
            "text-5xl font-bold opacity-30 transition group-hover:scale-105",
            product.image_url && "opacity-0"
          )}
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
              "absolute end-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-background/90 px-2.5 py-1 text-xs shadow-sm backdrop-blur",
              product.stockBadge === "low" &&
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
            )}
          >
            {badgeLabel}
            {product.stockQuantity !== null && ` · ${product.stockQuantity}`}
          </Badge>
        )}
        {product.hasVariants ? (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <Layers3 className="size-3.5 text-primary" />
            {product.variants.length} أحجام
          </span>
        ) : null}
        <span className="absolute bottom-2 end-2 flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-lg transition group-hover:scale-105 group-disabled:opacity-0 sm:h-11">
          <Plus className="size-4" />
          إضافة
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="line-clamp-2 text-base font-semibold leading-snug text-card-foreground">
          {product.name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{product.categoryName}</p>
          {product.hasVariants ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              اختر حجم
            </span>
          ) : null}
        </div>
        <div className="mt-auto rounded-2xl bg-muted/45 px-3 py-2">
          {showVariantPrice ? (
            <p className="text-xs text-muted-foreground">
              {priceRange ? "من أقل سعر" : "سعر الأحجام"}
            </p>
          ) : null}
          <p className="text-lg font-bold tabular-nums text-card-foreground">
            {formatCurrency(displayPrice)}
            {priceRange ? (
              <span className="ms-1 text-xs font-normal text-muted-foreground">{priceRange}</span>
            ) : null}
          </p>
        </div>
      </div>
    </button>
  );
}
