"use client";

import Image from "next/image";
import { Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { POSProduct } from "@/modules/pos/services/catalog.service";

const BADGE_LABELS = {
  in_stock: "متوفر",
  low: "قليل",
  out: "نفد",
  untracked: null,
} as const;

interface ProductTileProps {
  product: POSProduct;
  onAdd: () => void;
  disabled?: boolean;
  /** When false (e.g. supermarket), treat orphan variants as a single sell price. */
  showVariants?: boolean;
}

export function ProductTile({
  product,
  onAdd,
  disabled,
  showVariants = true,
}: ProductTileProps) {
  const badgeLabel = BADGE_LABELS[product.stockBadge];
  const outOfStock = product.stockBadge === "out";
  const variantPrices = product.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);
  const minVariantPrice = variantPrices[0];
  const maxVariantPrice = variantPrices.at(-1);
  const showVariantPrice =
    showVariants &&
    product.hasVariants &&
    minVariantPrice != null &&
    maxVariantPrice != null;
  const displayPrice = showVariantPrice
    ? minVariantPrice
    : product.hasVariants && minVariantPrice != null
      ? minVariantPrice
      : product.base_price;
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
        "group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl bg-card text-left text-card-foreground shadow-sm ring-1 ring-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[158px]"
      )}
    >
      <div
        className="relative flex aspect-[5/3] min-h-[72px] w-full items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${product.categoryColor}22, ${product.categoryColor}44)`,
        }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 14vw, (min-width: 640px) 25vw, 45vw"
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        {product.image_url ? (
          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
        ) : null}
        <span
          className={cn(
            "text-3xl font-bold opacity-30 transition group-hover:scale-105",
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
              "absolute end-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] shadow-sm backdrop-blur",
              product.stockBadge === "low" &&
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
            )}
          >
            {badgeLabel}
            {product.stockQuantity !== null && ` · ${product.stockQuantity}`}
          </Badge>
        )}
        {showVariants && product.hasVariants ? (
          <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
            <Layers3 className="size-3 text-primary" />
            {product.variants.length}
          </span>
        ) : null}
        <span className="absolute bottom-1.5 end-1.5 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-200 group-hover:scale-110 group-disabled:opacity-0 sm:size-10">
          <Plus className="size-4 sm:size-4.5" />
          <span className="sr-only">إضافة</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground">
          {product.name}
        </p>
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">{product.categoryName}</p>
        <div className="mt-auto rounded-xl border border-border/50 bg-muted/40 px-2 py-1.5">
          {showVariantPrice ? (
            <p className="text-[10px] text-muted-foreground">{priceRange ? "من" : "سعر"}</p>
          ) : null}
          <p className="text-sm font-bold tabular-nums text-card-foreground sm:text-[15px]">
            {formatCurrency(displayPrice)}
            {priceRange ? (
              <span className="ms-0.5 text-[10px] font-normal text-muted-foreground">{priceRange}</span>
            ) : null}
          </p>
        </div>
      </div>
    </button>
  );
}
