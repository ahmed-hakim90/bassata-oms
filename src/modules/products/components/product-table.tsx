"use client";

import { useTransition, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/lib/types";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { Button } from "@/components/ui/button";
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
  showEdit?: boolean;
  onEdit: (item: ProductGridItem) => void;
  onDelete: (product: Product) => void;
  emptyAction?: ReactNode;
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

export function ProductTable({
  items,
  currency = "EGP",
  priceMode = "sale",
  showEdit = true,
  onEdit,
  onDelete,
  emptyAction,
}: ProductTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <EmptyStateBlock
        title="لا توجد منتجات مطابقة"
        description="عدّل البحث أو التصنيف، أو أضف صنفًا جديدًا."
        action={emptyAction}
      />
    );
  }

  const rows = buildRows(items, priceMode);
  const priceHeader = priceMode === "cost" ? "تكلفة الوحدة" : "السعر";

  function savePrice(row: TableRowModel, raw: string) {
    const next = raw.trim() === "" ? null : Number(raw);
    if (next != null && !Number.isFinite(next)) {
      toast.error("السعر غير صالح");
      return;
    }
    if (next === row.price) return;

    startTransition(async () => {
      try {
        if (row.kind === "variant" && row.variant) {
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

  return (
    <DataTableShell title={`جدول المنتجات · ${currency}`}>
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الاسم</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الكود</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">التصنيف</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
              {priceHeader}
            </TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الحالة</TableHead>
            <TableHead className="h-10 text-xs font-semibold text-muted-foreground">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
              <TableRow key={row.key} className={!row.product.is_active ? "opacity-70" : undefined}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                <TableCell className="text-muted-foreground">{row.categoryName}</TableCell>
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
                    onBlur={(event) => savePrice(row, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
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
          ))}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
