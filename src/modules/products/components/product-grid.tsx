"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Package, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { formatUnit } from "@/lib/units";
import type { Category, Product, ProductVariant } from "@/lib/types";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveDisplayPriceRange } from "@/modules/products/lib/display-price-range";
import { updateProductAction } from "../actions/product.actions";

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
  availableStockByProductId?: Record<string, number>;
  availableStockByVariantId?: Record<string, number>;
  onEdit: (item: ProductGridItem) => void;
  onDelete: (product: Product) => void;
  emptyAction?: ReactNode;
}

function stockForProduct(
  product: Product,
  variants: ProductVariant[],
  byProduct: Record<string, number>,
  byVariant: Record<string, number>
): number | null {
  if (!product.track_inventory) return null;
  if (variants.length > 0) {
    const sum = variants.reduce((total, variant) => {
      const qty = byVariant[variant.id] ?? 0;
      return total + qty;
    }, 0);
    if (sum > 0 || variants.some((variant) => variant.id in byVariant)) {
      return sum;
    }
  }
  return byProduct[product.id] ?? 0;
}

export function ProductGrid({
  items,
  currency = "EGP",
  priceMode = "sale",
  showEdit = true,
  availableStockByProductId = {},
  availableStockByVariantId = {},
  onEdit,
  onDelete,
  emptyAction,
}: ProductGridProps) {
  const [localItems, setLocalItems] = useState(items);
  const snapshotRef = useRef<ProductGridItem[] | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  function setActive(product: Product, isActive: boolean) {
    if (product.is_active === isActive) return;
    snapshotRef.current = localItems;
    setLocalItems((prev) =>
      prev.map((item) =>
        item.product.id === product.id
          ? { ...item, product: { ...item.product, is_active: isActive } }
          : item
      )
    );

    void (async () => {
      try {
        await updateProductAction(product.id, { is_active: isActive });
      } catch (error) {
        if (snapshotRef.current) setLocalItems(snapshotRef.current);
        toast.error(error instanceof Error ? error.message : "تعذر تحديث حالة المنتج");
      }
    })();
  }

  if (localItems.length === 0) {
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
      {localItems.map(
        ({
          product,
          category,
          hasRecipe,
          variants = [],
          variantCount = 0,
          missingRecipeVariantCount = 0,
          variantPrices = [],
        }) => {
          const sortedVariantPrices = variantPrices.filter((price) => Number.isFinite(price));
          const showVariantPrice =
            priceMode === "sale" && sortedVariantPrices.length > 0 && variantCount > 0;
          const saleDisplay = resolveDisplayPriceRange({
            variantPrices: showVariantPrice ? sortedVariantPrices : [],
            baseAmount: product.base_price,
            currency,
            showRange: showVariantPrice,
            rangeSeparator: "en-dash",
          });
          const amount = priceMode === "cost" ? product.last_unit_cost : saleDisplay.amount;
          const unitSuffix =
            priceMode === "cost" && product.cost_unit ? ` / ${formatUnit(product.cost_unit)}` : "";
          const priceRange = priceMode === "sale" ? saleDisplay.rangeLabel : "";
          const stock = stockForProduct(
            product,
            variants,
            availableStockByProductId,
            availableStockByVariantId
          );
          const code = product.barcode || product.sku;

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
                  {missingRecipeVariantCount > 0 ? (
                    <StatusPill label="تكلفة ناقصة" variant="warning" />
                  ) : null}
                  {product.is_popular ? <StatusPill label="شائع" variant="info" /> : null}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-[var(--mds-space-3)] p-[var(--mds-space-4)]">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {category?.name ?? "غير مصنف"}
                    </p>
                    <StatusPill
                      label={product.is_active ? "نشط" : "متوقف"}
                      variant={product.is_active ? "success" : "warning"}
                    />
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                    {product.name}
                  </h3>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {code}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--mds-radius-md)] border border-border/60 bg-muted/20 p-[var(--mds-space-3)]">
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-[11px] text-muted-foreground">
                      {priceMode === "cost"
                        ? "تكلفة الوحدة"
                        : showVariantPrice && priceRange
                          ? "نطاق السعر"
                          : "السعر"}
                    </dt>
                    <dd className="truncate text-sm font-semibold tabular-nums tracking-tight">
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
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-0.5 text-end">
                    <dt className="text-[11px] text-muted-foreground">المخزون</dt>
                    <dd className="truncate text-sm font-semibold tabular-nums tracking-tight">
                      {stock == null ? (
                        <span className="font-normal text-muted-foreground">غير متتبع</span>
                      ) : (
                        <>
                          {stock}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatUnit(product.unit)}
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                  {variantCount > 0 || hasRecipe ? (
                    <div className="col-span-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
                      {variantCount > 0 ? (
                        <StatusPill label={`${variantCount} أحجام`} variant="info" />
                      ) : null}
                      {hasRecipe ? <StatusPill label="وصفة" variant="info" /> : null}
                    </div>
                  ) : null}
                </dl>

                <div className="mt-auto flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={product.is_active ? "outline" : "default"}
                    className="h-9 flex-1"
                    onClick={() => setActive(product, !product.is_active)}
                    aria-label={
                      product.is_active ? `إيقاف ${product.name}` : `تفعيل ${product.name}`
                    }
                  >
                    <Power className="size-3.5" />
                    {product.is_active ? "إيقاف" : "تفعيل"}
                  </Button>
                  {showEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
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
                      aria-label={`تعديل ${product.name}`}
                    >
                      <Pencil className="size-3.5" />
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
