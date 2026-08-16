"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperationalCard } from "@/components/Velora/operational-card";
import { selectLabelById } from "@/lib/select-label";
import { reportFiltersToSearchParams } from "@/modules/reports/core/report-filters.schema";
import type { Category, Product, Store, Warehouse } from "@/lib/types";
import {
  StockCountScopeFields,
  type StockCountScopeValue,
} from "./stock-count-scope-fields";

interface StockCountSheetFormProps {
  stores: Store[];
  warehouses: Warehouse[];
  categories: Category[];
  products: Product[];
  defaultStoreId: string;
}

export function StockCountSheetForm({
  stores,
  warehouses,
  categories,
  products,
  defaultStoreId,
}: StockCountSheetFormProps) {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [scope, setScope] = useState<StockCountScopeValue>(() => ({
    warehouseId:
      warehouses.find((w) => w.store_id === defaultStoreId && w.is_default)?.id ??
      warehouses.find((w) => w.store_id === defaultStoreId)?.id ??
      "",
    categoryId: "all",
    productId: "",
    productQuery: "",
  }));

  const storeWarehouses = useMemo(
    () => warehouses.filter((w) => w.store_id === storeId && w.is_active),
    [warehouses, storeId]
  );

  const printHref = scope.warehouseId
    ? `/print/stock-count?${reportFiltersToSearchParams({
        storeId: stores.length > 1 ? storeId : undefined,
        warehouseId: scope.warehouseId,
        categoryId: scope.categoryId === "all" ? undefined : scope.categoryId,
        productId: scope.productId || undefined,
      })}`
    : undefined;

  return (
    <OperationalCard
      title="طباعة ورقة جرد"
      description="اطبع قائمة أصناف لفرع أو مخزن أو قسم أو منتج — عمود المعدود فاضي عشان تكتب على الورق"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stores.length > 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="count-sheet-store">الفرع</Label>
            <Select
              value={storeId}
              onValueChange={(value) => {
                const next = value ?? defaultStoreId;
                setStoreId(next);
                setScope({
                  warehouseId:
                    warehouses.find((w) => w.store_id === next && w.is_default)?.id ??
                    warehouses.find((w) => w.store_id === next)?.id ??
                    "",
                  categoryId: "all",
                  productId: "",
                  productQuery: "",
                });
              }}
            >
              <SelectTrigger id="count-sheet-store" className="h-11">
                <SelectValue placeholder="الفرع">
                  {(value) => selectLabelById(stores, value, (s) => s.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id} label={store.name}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <StockCountScopeFields
          idPrefix="count-sheet"
          warehouses={storeWarehouses}
          categories={categories}
          products={products}
          value={scope}
          onChange={setScope}
        />
      </div>

      <div className="mt-4">
        <CompactActions className="justify-start">
          <CompactAction
            label="طباعة ورقة الجرد"
            icon={Printer}
            variant="default"
            href={printHref}
            disabled={!printHref}
            alwaysLabeled
          />
        </CompactActions>
      </div>
    </OperationalCard>
  );
}
