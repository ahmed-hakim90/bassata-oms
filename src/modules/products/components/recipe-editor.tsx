"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MeasurementUnit, Product } from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import {
  getRecipeAction,
  listIngredientsAction,
  saveRecipeAction,
} from "@/modules/products/actions/recipe.actions";
import { toast } from "sonner";

interface RecipeLineDraft {
  ingredient_product_id: string;
  quantity: number;
  unit: MeasurementUnit;
}

interface RecipeEditorProps {
  product: Product;
  currency: string;
  variantId?: string | null;
  variantLabel?: string;
  salePrice?: number;
  onSaved?: () => void;
}

export function RecipeEditor({
  product,
  currency,
  variantId,
  variantLabel,
  salePrice,
  onSaved,
}: RecipeEditorProps) {
  const [ingredients, setIngredients] = useState<Product[]>([]);
  const [lines, setLines] = useState<RecipeLineDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [ings, recipe] = await Promise.all([
          listIngredientsAction(),
          getRecipeAction(product.id, variantId ?? null),
        ]);
        if (cancelled) return;
        setIngredients(ings);
        if (recipe?.lines.length) {
          setLines(
            recipe.lines.map((l) => ({
              ingredient_product_id: l.ingredient_product_id,
              quantity: l.quantity,
              unit: l.unit,
            }))
          );
        } else {
          setLines([{ ingredient_product_id: "", quantity: 1, unit: "piece" }]);
        }
      } catch {
        if (!cancelled) toast.error("تعذر تحميل الوصفة");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [product.id, variantId]);

  const recipeCost = lines.reduce((sum, line) => {
    const ing = ingredients.find((i) => i.id === line.ingredient_product_id);
    if (!ing || line.quantity <= 0) return sum;
    const costQty =
      line.unit === ing.cost_unit
        ? line.quantity
        : line.unit === "kg" && ing.cost_unit === "gram"
          ? line.quantity * 1000
          : line.unit === "gram" && ing.cost_unit === "kg"
            ? line.quantity / 1000
            : line.unit === "liter" && ing.cost_unit === "ml"
              ? line.quantity * 1000
              : line.unit === "ml" && ing.cost_unit === "liter"
                ? line.quantity / 1000
                : line.unit === ing.cost_unit
                  ? line.quantity
                  : line.quantity;
    return sum + costQty * ing.last_unit_cost;
  }, 0);

  const price = salePrice ?? product.base_price;
  const profit = price - recipeCost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  function addLine() {
    setLines((prev) => [...prev, { ingredient_product_id: "", quantity: 1, unit: "piece" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<RecipeLineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  async function handleSave() {
    const valid = lines.filter(
      (l) => l.ingredient_product_id && l.quantity > 0
    );
    if (valid.length === 0) {
      toast.error("أضف مكوّن واحد على الأقل");
      return;
    }
    setSaving(true);
    try {
      await saveRecipeAction(product.id, valid, variantId ?? null);
      toast.success("تم حفظ الوصفة");
      onSaved?.();
    } catch {
      toast.error("تعذر حفظ الوصفة");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">جاري تحميل الوصفة…</p>;
  }

  return (
    <div className="grid gap-4">
      {variantLabel ? (
        <p className="text-sm text-muted-foreground">وصفة {variantLabel}</p>
      ) : null}
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_100px_120px_auto]">
            <div className="grid gap-1">
              <Label className="text-xs">المكوّن</Label>
              <Select
                value={line.ingredient_product_id}
                onValueChange={(v) =>
                  updateLine(index, { ingredient_product_id: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختار مكوّن">
                    {(value) => selectLabelById(ingredients, value, (ing) => ing.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((ing) => (
                    <SelectItem key={ing.id} value={ing.id} label={ing.name}>
                      {ing.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">الكمية</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={line.quantity}
                onChange={(e) =>
                  updateLine(index, { quantity: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">الوحدة</Label>
              <Select
                value={line.unit}
                onValueChange={(v) =>
                  updateLine(index, { unit: (v ?? "piece") as MeasurementUnit })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value ? formatUnit(value as MeasurementUnit) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} label={formatUnit(u)}>
                      {formatUnit(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(index)}
                disabled={lines.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine}>
        <Plus className="size-4" />
        إضافة مكوّن
      </Button>

      <div className="rounded-lg bg-muted/50 p-4 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">تكلفة الوصفة</p>
            <p className="font-semibold">{formatCurrency(recipeCost, currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">سعر البيع</p>
            <p className="font-semibold">{formatCurrency(price, currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">الربح</p>
            <p className="font-semibold">{formatCurrency(profit, currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">الهامش</p>
            <p className="font-semibold">{margin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "جاري الحفظ…" : "حفظ الوصفة"}
      </Button>
    </div>
  );
}
