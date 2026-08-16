"use client";

import { useMemo, useState, useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperationalCard } from "@/components/Velora/operational-card";
import type { Category, Product, Warehouse } from "@/lib/types";
import { startCountAction } from "@/modules/stock-count/actions/count.actions";
import {
  StockCountScopeFields,
  type StockCountScopeValue,
} from "./stock-count-scope-fields";

interface StockCountStartFormProps {
  warehouses: Warehouse[];
  categories: Category[];
  products: Product[];
  barcodeScannerEnabled: boolean;
  onStarted: () => void;
}

export function StockCountStartForm({
  warehouses,
  categories,
  products,
  barcodeScannerEnabled,
  onStarted,
}: StockCountStartFormProps) {
  const [pending, startTransition] = useTransition();
  const [countFromZero, setCountFromZero] = useState(barcodeScannerEnabled);
  const [scope, setScope] = useState<StockCountScopeValue>(() => ({
    warehouseId:
      warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "",
    categoryId: "all",
    productId: "",
    productQuery: "",
  }));

  const previewCount = useMemo(
    () =>
      products.filter((product) => {
        if (!product.track_inventory) return false;
        if (scope.categoryId !== "all" && product.category_id !== scope.categoryId) {
          return false;
        }
        if (scope.productId && product.id !== scope.productId) return false;
        return true;
      }).length,
    [products, scope.categoryId, scope.productId]
  );

  const startCount = () => {
    startTransition(async () => {
      try {
        await startCountAction({
          warehouseId: scope.warehouseId,
          categoryId: scope.categoryId === "all" ? undefined : scope.categoryId,
          productId: scope.productId || undefined,
          countFromZero,
        });
        toast.success(
          countFromZero ? "تم بدء الجرد من صفر — امسح الباركود" : "تم بدء الجرد"
        );
        onStarted();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل بدء الجرد");
      }
    });
  };

  return (
    <OperationalCard
      title="بدء جرد"
      description="جرد مخزن كامل، أو قسم، أو منتج واحد. السكانر بيزود 1 لكل مسحة."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StockCountScopeFields
          idPrefix="count-start"
          warehouses={warehouses.filter((w) => w.is_active)}
          categories={categories}
          products={products}
          value={scope}
          onChange={setScope}
        />
        <div className="flex items-start gap-3 sm:col-span-2">
          <Checkbox
            id="count-from-zero"
            checked={countFromZero}
            onCheckedChange={(checked) => setCountFromZero(checked === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="count-from-zero">ابدأ العد من صفر</Label>
            <p className="text-sm text-muted-foreground">
              مناسب للسكانر: كل مسحة +1. لو مش متعلّم، سيبه مقفول ويبدأ برصيد النظام.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {previewCount} صنف هيتدرج في الجرد
        </p>
        <CompactActions>
          <CompactAction
            label="بدء الجرد"
            icon={Play}
            variant="default"
            disabled={pending || !scope.warehouseId || previewCount === 0}
            alwaysLabeled
            onClick={startCount}
          />
        </CompactActions>
      </div>
    </OperationalCard>
  );
}
