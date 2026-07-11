"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Category, Product, ProductVariant } from "@/lib/types";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
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
}

export function ProductGrid({
  items,
  currency = "USD",
  priceMode = "sale",
  showEdit = true,
  onEdit,
  onDelete,
}: ProductGridProps) {
  if (items.length === 0) {
    return (
      <GlassPanel className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">لا توجد منتجات مطابقة للفلاتر.</p>
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map(({
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
        const unitSuffix = priceMode === "cost" && product.cost_unit ? ` / ${product.cost_unit}` : "";
        const priceRange =
          showVariantPrice && maxVariantPrice > minVariantPrice
            ? ` إلى ${formatCurrency(maxVariantPrice, currency)}`
            : "";
        return (
          <GlassPanel
            key={product.id}
            className={cn(
              "group flex flex-col overflow-hidden p-0",
              !product.is_active && "opacity-70"
            )}
          >
            <div
              className="relative flex h-28 items-end justify-between overflow-hidden p-4"
              style={{
                background: `linear-gradient(135deg, ${category?.color ?? "#94A3B8"}33, transparent)`,
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
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <div
                className="relative flex size-12 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: product.image_url ? "rgb(15 23 42 / 0.65)" : category?.color ?? "#64748B" }}
              >
                {product.image_url ? (
                  <span className="text-lg font-semibold">{product.name.slice(0, 1)}</span>
                ) : (
                  <Package className="size-5" />
                )}
              </div>
              <div className="relative flex flex-col items-end gap-1">
                {variantCount > 0 ? (
                  <StatusPill label={`${variantCount} أحجام`} variant="info" />
                ) : null}
                {hasRecipe ? <StatusPill label="وصفة" variant="info" /> : null}
                {missingRecipeVariantCount > 0 ? (
                  <StatusPill label="تكلفة ناقصة" variant="warning" />
                ) : null}
                {product.product_type === "ingredient" ? (
                  <StatusPill label="مكوّن" variant="default" />
                ) : null}
                {product.is_popular ? (
                  <StatusPill label="شائع" variant="info" />
                ) : null}
                {!product.is_active ? (
                  <StatusPill label="غير نشط" variant="default" />
                ) : null}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {category?.name ?? "غير مصنف"}
                </p>
                <h3 className="font-semibold leading-tight">{product.name}</h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {product.sku} · {product.barcode}
                </p>
              </div>

              <div className="mt-auto flex items-end justify-between gap-2">
                <div>
                  {priceMode === "cost" ? (
                    <p className="text-xs text-muted-foreground">تكلفة الوحدة</p>
                  ) : showVariantPrice ? (
                    <p className="text-xs text-muted-foreground">
                      {priceRange ? "من أقل سعر" : "سعر الأحجام"}
                    </p>
                  ) : null}
                  <p className="text-xl font-semibold tabular-nums">
                    {formatCurrency(amount, currency)}
                    {priceRange ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {priceRange}
                      </span>
                    ) : null}
                    {unitSuffix ? (
                      <span className="text-xs font-normal text-muted-foreground">{unitSuffix}</span>
                    ) : null}
                  </p>
                </div>
                {product.track_inventory ? (
                  <StatusPill label="متتبع" variant="success" />
                ) : (
                  <StatusPill label="غير متتبع" variant="default" />
                )}
              </div>

              <div className="flex gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                {showEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
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
                    تعديل
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onDelete(product)}
                >
                  حذف
                </Button>
              </div>
            </div>
          </GlassPanel>
        );
      })}
    </div>
  );
}
