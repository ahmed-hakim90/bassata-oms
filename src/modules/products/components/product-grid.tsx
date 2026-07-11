"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Package, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Category, Product, ProductVariant } from "@/lib/types";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProductGridItem {
  product: Product;
  category: Category | null;
  hasRecipe?: boolean;
  variants?: ProductVariant[];
  variantCount?: number;
  missingRecipeVariantCount?: number;
  variantPrices?: number[];
}

interface ProductGridProps {
  items: ProductGridItem[];
  currency?: string;
  priceMode?: "sale" | "cost";
  showEdit?: boolean;
  onEdit: (item: ProductGridItem) => void;
  onDelete: (product: Product) => void;
  emptyAction?: ReactNode;
}

export function ProductGrid({
  items,
  currency = "USD",
  priceMode = "sale",
  showEdit = true,
  onEdit,
  onDelete,
  emptyAction,
}: ProductGridProps) {
  if (items.length === 0) {
    return (
      <EmptyStateBlock
        title="لا توجد منتجات مطابقة"
        description="عدّل البحث أو التصنيف، أو أضف صنفًا جديدًا."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map(
        ({
          product,
          category,
          hasRecipe,
          variants = [],
          variantCount = 0,
          missingRecipeVariantCount = 0,
          variantPrices = [],
        }) => {
          const sortedVariantPrices = variantPrices
            .filter((price) => Number.isFinite(price))
            .sort((a, b) => a - b);
          const minVariantPrice = sortedVariantPrices[0];
          const maxVariantPrice = sortedVariantPrices.at(-1);
          const showVariantPrice =
            priceMode === "sale" &&
            minVariantPrice != null &&
            maxVariantPrice != null &&
            variantCount > 0;
          const amount =
            priceMode === "cost"
              ? product.last_unit_cost
              : showVariantPrice
                ? minVariantPrice
                : product.base_price;
          const unitSuffix =
            priceMode === "cost" && product.cost_unit ? ` / ${product.cost_unit}` : "";
          const priceRange =
            showVariantPrice && maxVariantPrice > minVariantPrice
              ? ` – ${formatCurrency(maxVariantPrice, currency)}`
              : "";

          return (
            <article
              key={product.id}
              className={cn(
                "group flex flex-col overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card shadow-[var(--mds-elevation-1)] transition-shadow hover:shadow-[var(--mds-elevation-2)]",
                !product.is_active && "opacity-70"
              )}
            >
              <div
                className="relative aspect-[16/9] overflow-hidden bg-muted/40"
                style={{
                  background: product.image_url
                    ? undefined
                    : `linear-gradient(145deg, ${category?.color ?? "var(--mds-color-action-primary)"}33, transparent 70%)`,
                }}
              >
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex size-14 items-center justify-center rounded-[var(--mds-radius-md)] text-white shadow-[var(--mds-elevation-1)]"
                      style={{ backgroundColor: category?.color ?? "#64748B" }}
                    >
                      <Package className="size-6" aria-hidden />
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 p-[var(--mds-space-2)]">
                  {variantCount > 0 ? (
                    <StatusPill label={`${variantCount} أحجام`} variant="info" />
                  ) : null}
                  {hasRecipe ? <StatusPill label="وصفة" variant="info" /> : null}
                  {missingRecipeVariantCount > 0 ? (
                    <StatusPill label="تكلفة ناقصة" variant="warning" />
                  ) : null}
                  {product.is_popular ? <StatusPill label="شائع" variant="info" /> : null}
                  {!product.is_active ? (
                    <StatusPill label="غير نشط" variant="default" />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-[var(--mds-space-3)] p-[var(--mds-space-4)]">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {category?.name ?? "غير مصنف"}
                  </p>
                  <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                    {product.name}
                  </h3>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ""}
                  </p>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/60 pt-[var(--mds-space-3)]">
                  <div className="min-w-0">
                    {priceMode === "cost" ? (
                      <p className="text-[11px] text-muted-foreground">تكلفة الوحدة</p>
                    ) : showVariantPrice && priceRange ? (
                      <p className="text-[11px] text-muted-foreground">نطاق السعر</p>
                    ) : null}
                    <p className="truncate text-lg font-semibold tabular-nums tracking-tight">
                      {formatCurrency(amount, currency)}
                      {priceRange ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {priceRange}
                        </span>
                      ) : null}
                      {unitSuffix ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {unitSuffix}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {product.track_inventory ? (
                    <StatusPill label="متتبع" variant="success" />
                  ) : (
                    <StatusPill label="غير متتبع" variant="default" />
                  )}
                </div>

                <div className="flex gap-2">
                  {showEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1"
                      onClick={() =>
                        onEdit({
                          product,
                          category,
                          hasRecipe,
                          variantCount,
                          missingRecipeVariantCount,
                          variantPrices,
                          variants,
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                      تعديل
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(product)}
                    aria-label={`حذف ${product.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          );
        }
      )}
    </div>
  );
}
