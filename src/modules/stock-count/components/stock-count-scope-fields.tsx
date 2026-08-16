"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabelById } from "@/lib/select-label";
import { ProductSearchCombobox } from "@/modules/products/components/product-search-combobox";
import type { Category, Product, Warehouse } from "@/lib/types";

export interface StockCountScopeValue {
  warehouseId: string;
  categoryId: string;
  productId: string;
  productQuery: string;
}

interface StockCountScopeFieldsProps {
  idPrefix: string;
  warehouses: Warehouse[];
  categories: Category[];
  products: Product[];
  value: StockCountScopeValue;
  onChange: (next: StockCountScopeValue) => void;
}

export function StockCountScopeFields({
  idPrefix,
  warehouses,
  categories,
  products,
  value,
  onChange,
}: StockCountScopeFieldsProps) {
  const trackedProducts = products.filter((product) => {
    if (!product.track_inventory) return false;
    if (value.categoryId !== "all" && product.category_id !== value.categoryId) {
      return false;
    }
    return true;
  });

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-warehouse`}>المخزن</Label>
        <Select
          value={value.warehouseId}
          onValueChange={(warehouseId) =>
            onChange({ ...value, warehouseId: warehouseId ?? "" })
          }
        >
          <SelectTrigger id={`${idPrefix}-warehouse`} className="h-11">
            <SelectValue placeholder="المخزن">
              {(selected) => selectLabelById(warehouses, selected, (w) => w.name)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id} label={warehouse.name}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>قسم المنتجات</Label>
        <Select
          value={value.categoryId}
          onValueChange={(categoryId) =>
            onChange({
              ...value,
              categoryId: categoryId ?? "all",
              productId: "",
              productQuery: "",
            })
          }
        >
          <SelectTrigger id={`${idPrefix}-category`} className="h-11">
            <SelectValue placeholder="كل الأقسام">
              {(selected) =>
                selected === "all"
                  ? "كل الأقسام"
                  : selectLabelById(categories, selected, (c) => c.name)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="كل الأقسام">
              كل الأقسام
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id} label={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <ProductSearchCombobox
          products={trackedProducts}
          value={value.productQuery}
          onChange={(productQuery) => onChange({ ...value, productQuery })}
          selectedProductId={value.productId || undefined}
          onSelect={(product) =>
            onChange({
              ...value,
              productId: product.id,
              productQuery: product.name,
            })
          }
          label="منتج واحد (اختياري)"
          placeholder="سيب فاضي لكل الأصناف — أو ابحث عن منتج"
        />
        {value.productId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() =>
              onChange({ ...value, productId: "", productQuery: "" })
            }
          >
            إلغاء اختيار المنتج
          </Button>
        ) : null}
      </div>
    </>
  );
}
