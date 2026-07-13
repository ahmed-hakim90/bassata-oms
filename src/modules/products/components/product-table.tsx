"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/lib/types";
import { formatUnit, productHasPurchasePacking } from "@/lib/units";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateProductAction } from "../actions/product.actions";
import { updateVariantAction } from "../actions/variant.actions";
import type { ProductGridItem } from "./product-grid";

type PriceMode = "sale" | "cost";

interface TableRowModel {
  key: string;
  item: ProductGridItem;
  product: Product;
  categoryName: string;
  variant: ProductVariant | null;
  label: string;
  sku: string;
  price: number | null;
  kind: "variant" | "product";
}

interface ProductTableProps {
  items: ProductGridItem[];
  currency?: string;
  priceMode?: PriceMode;
  /** Supermarket catalog: units + purchase price columns with simpler labels. */
  supermarketColumns?: boolean;
  showEdit?: boolean;
  availableStockByProductId?: Record<string, number>;
  availableStockByVariantId?: Record<string, number>;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onEdit: (item: ProductGridItem) => void;
  onDelete: (product: Product) => void;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
}

function formatProductUnits(product: Product): string {
  const sell =
    product.sales_unit_type === "weight"
      ? "بالكيلو"
      : product.sales_unit_type === "volume"
        ? formatUnit(product.sale_unit ?? product.unit)
        : "بالقطعة";
  if (
    productHasPurchasePacking({
      unit: product.unit,
      base_unit: product.base_unit ?? product.unit,
      cost_unit: product.cost_unit,
      units_per_purchase_unit: product.units_per_purchase_unit,
    })
  ) {
    const packUnit = formatUnit(product.cost_unit);
    const count = product.units_per_purchase_unit ?? 1;
    return `${sell} · ${packUnit} فيها ${count}`;
  }
  return sell;
}

function buildRows(items: ProductGridItem[], priceMode: PriceMode): TableRowModel[] {
  const rows: TableRowModel[] = [];
  for (const item of items) {
    const { product, category, variants = [] } = item;
    const categoryName = category?.name ?? "—";
    if (priceMode === "sale" && variants.length > 0) {
      for (const variant of variants) {
        rows.push({
          key: `${product.id}:${variant.id}`,
          item,
          product,
          categoryName,
          variant,
          label: `${product.name} · ${variant.name}`,
          sku: variant.sku || product.sku,
          price: variant.price ?? variant.fixed_price,
          kind: "variant",
        });
      }
      continue;
    }

    rows.push({
      key: product.id,
      item,
      product,
      categoryName,
      variant: null,
      label: product.name,
      sku: product.sku,
      price: priceMode === "cost" ? product.last_unit_cost : product.base_price,
      kind: "product",
    });
  }
  return rows;
}

function stockForRow(
  row: TableRowModel,
  byProduct: Record<string, number>,
  byVariant: Record<string, number>
): number | null {
  if (!row.product.track_inventory) return null;
  if (row.variant) {
    return byVariant[row.variant.id] ?? byProduct[row.product.id] ?? 0;
  }
  return byProduct[row.product.id] ?? 0;
}

export function ProductTable({
  items,
  currency = "EGP",
  priceMode = "sale",
  supermarketColumns = false,
  showEdit = true,
  availableStockByProductId = {},
  availableStockByVariantId = {},
  selectedIds = [],
  onSelectedIdsChange,
  onEdit,
  onDelete,
  emptyAction,
  toolbar,
}: ProductTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selectable = typeof onSelectedIdsChange === "function";

  const rows = useMemo(() => buildRows(items, priceMode), [items, priceMode]);
  const visibleProductIds = useMemo(
    () => [...new Set(rows.map((row) => row.product.id))],
    [rows]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleProductIds.length > 0 &&
    visibleProductIds.every((id) => selectedSet.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleProductIds.some((id) => selectedSet.has(id));

  if (items.length === 0) {
    return (
      <EmptyStateBlock
        title="لا توجد منتجات مطابقة"
        description="عدّل البحث أو التصنيف، أو أضف صنفًا جديدًا."
        action={emptyAction}
      />
    );
  }

  const priceHeader = supermarketColumns
    ? "سعر البيع"
    : priceMode === "cost"
      ? "تكلفة الوحدة"
      : "السعر";
  const codeHeader = supermarketColumns ? "الباركود" : "الكود";

  function toggleProduct(productId: string, checked: boolean) {
    if (!onSelectedIdsChange) return;
    if (checked) {
      onSelectedIdsChange([...new Set([...selectedIds, productId])]);
      return;
    }
    onSelectedIdsChange(selectedIds.filter((id) => id !== productId));
  }

  function toggleAllVisible(checked: boolean) {
    if (!onSelectedIdsChange) return;
    if (checked) {
      onSelectedIdsChange([...new Set([...selectedIds, ...visibleProductIds])]);
      return;
    }
    const hide = new Set(visibleProductIds);
    onSelectedIdsChange(selectedIds.filter((id) => !hide.has(id)));
  }

  function savePrice(row: TableRowModel, raw: string, field: "sale" | "purchase" = "sale") {
    const next = raw.trim() === "" ? null : Number(raw);
    if (next != null && !Number.isFinite(next)) {
      toast.error("السعر غير صالح");
      return;
    }
    const current = field === "purchase" ? row.product.last_unit_cost : row.price;
    if (next === current) return;

    startTransition(async () => {
      try {
        if (field === "purchase") {
          await updateProductAction(row.product.id, {
            last_unit_cost: next ?? 0,
          });
        } else if (row.kind === "variant" && row.variant) {
          await updateVariantAction(row.variant.id, {
            price: next,
            fixed_price: next,
            price_mode: next != null ? "fixed_price" : row.variant.price_mode,
          });
        } else if (priceMode === "cost") {
          await updateProductAction(row.product.id, {
            last_unit_cost: next ?? 0,
          });
        } else {
          await updateProductAction(row.product.id, {
            base_price: next ?? 0,
          });
        }
        toast.success("تم تحديث السعر");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث السعر");
      }
    });
  }

  function setTracking(product: Product, trackInventory: boolean) {
    if (product.track_inventory === trackInventory) return;
    startTransition(async () => {
      try {
        await updateProductAction(product.id, {
          track_inventory: trackInventory,
          inventory_tracking_mode: trackInventory ? "standard" : "none",
          ...(trackInventory ? {} : { expiry_tracking_enabled: false }),
        });
        toast.success(
          trackInventory ? `تم تفعيل تتبع المخزون لـ ${product.name}` : `تم إيقاف التتبع لـ ${product.name}`
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث التتبع");
      }
    });
  }

  return (
    <DataTableShell
      title={`جدول المنتجات · ${currency}`}
      actions={toolbar}
    >
      <Table className={supermarketColumns ? "min-w-[1100px]" : "min-w-[920px]"}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className="h-10 w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  aria-label="تحديد كل المنتجات الظاهرة"
                  onCheckedChange={(value) => toggleAllVisible(value === true)}
                />
              </TableHead>
            ) : null}
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الاسم</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
              {codeHeader}
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">التصنيف</TableHead>
            {supermarketColumns ? (
              <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                الوحدات
              </TableHead>
            ) : null}
            {supermarketColumns ? (
              <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                سعر الشراء
              </TableHead>
            ) : null}
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
              {priceHeader}
            </TableHead>
            <TableHead className="h-10 text-end text-xs font-semibold text-muted-foreground">
              المخزون المتاح
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
              تتبع المخزون
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الحالة</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const stock = stockForRow(
              row,
              availableStockByProductId,
              availableStockByVariantId
            );
            const isFirstProductRow =
              rows.find((candidate) => candidate.product.id === row.product.id)?.key === row.key;
            return (
              <TableRow key={row.key} className={!row.product.is_active ? "opacity-70" : undefined}>
                {selectable ? (
                  <TableCell>
                    {isFirstProductRow ? (
                      <Checkbox
                        checked={selectedSet.has(row.product.id)}
                        aria-label={`تحديد ${row.product.name}`}
                        onCheckedChange={(value) =>
                          toggleProduct(row.product.id, value === true)
                        }
                      />
                    ) : (
                      <span className="sr-only">تابع لـ {row.product.name}</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {supermarketColumns ? row.product.barcode || row.sku : row.sku}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.categoryName}</TableCell>
                {supermarketColumns ? (
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatProductUnits(row.product)}
                  </TableCell>
                ) : null}
                {supermarketColumns ? (
                  <TableCell className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      className="h-8 tabular-nums"
                      defaultValue={row.product.last_unit_cost ?? ""}
                      key={`${row.key}:cost:${row.product.last_unit_cost ?? "empty"}`}
                      disabled={pending || row.kind === "variant"}
                      aria-label={`سعر الشراء لـ ${row.label}`}
                      onBlur={(event) => savePrice(row, event.target.value, "purchase")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="w-36">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="h-8 tabular-nums"
                    defaultValue={row.price ?? ""}
                    key={`${row.key}:${row.price ?? "empty"}`}
                    disabled={pending}
                    aria-label={`${priceHeader} لـ ${row.label}`}
                    onBlur={(event) => savePrice(row, event.target.value, "sale")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {stock == null ? (
                    <span className="text-muted-foreground" title="التتبع غير مفعّل">
                      —
                    </span>
                  ) : (
                    <span>
                      {stock}{" "}
                      <span className="text-xs text-muted-foreground">
                        {formatUnit(row.product.unit)}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {isFirstProductRow ? (
                    <Checkbox
                      checked={row.product.track_inventory}
                      disabled={pending}
                      aria-label={`تتبع مخزون ${row.product.name}`}
                      onCheckedChange={(value) =>
                        setTracking(row.product, value === true)
                      }
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {row.product.track_inventory ? "نعم" : "لا"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusPill
                    label={row.product.is_active ? "نشط" : "متوقف"}
                    variant={row.product.is_active ? "success" : "warning"}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {showEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`تعديل ${row.product.name}`}
                        onClick={() => onEdit(row.item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      aria-label={`حذف ${row.product.name}`}
                      onClick={() => onDelete(row.product)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
