"use client";

import { useMemo, useState, useTransition } from "react";
import type { Category, MeasurementUnit, Product } from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
import { formatUnit } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { createCafeIngredientAction } from "@/modules/products/actions/product.actions";
import { toast } from "sonner";

type CafeIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  ingredients: Product[];
  onSaved?: () => void;
};

export function CafeIngredientDialog({
  open,
  onOpenChange,
  categories,
  ingredients,
  onSaved,
}: CafeIngredientDialogProps) {
  const [pending, startTransition] = useTransition();
  const defaultCategoryId = useMemo(
    () =>
      ingredients[0]?.category_id ??
      categories.find((category) =>
        /مكون|مكونات|ingredient|inventory|مخزون/i.test(category.name)
      )?.id ??
      categories[0]?.id ??
      "",
    [categories, ingredients]
  );
  const [form, setForm] = useState({
    name: "",
    unit: "piece" as MeasurementUnit,
    unit_cost: "",
  });

  function reset() {
    setForm({ name: "", unit: "piece", unit_cost: "" });
  }

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Ingredient name is required");
      return;
    }
    if (!defaultCategoryId) {
      toast.error("Add an ingredient category first");
      return;
    }

    startTransition(async () => {
      try {
        await createCafeIngredientAction({
          name,
          category_id: defaultCategoryId,
          unit: form.unit,
          unit_cost: Number(form.unit_cost) || 0,
        });
        toast.success("Ingredient added");
        reset();
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add ingredient");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <StandardModalContent
        size="md"
        title="New ingredient"
        description="Add a reusable cafe ingredient with simple defaults."
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="ingredient_name">Ingredient name</Label>
            <Input
              id="ingredient_name"
              value={form.name}
              placeholder="Milk, sugar, espresso beans..."
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.unit}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    unit: (value ?? "piece") as MeasurementUnit,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value) => (value ? formatUnit(value as MeasurementUnit) : null)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit} label={formatUnit(unit)}>
                      {formatUnit(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ingredient_cost">Unit cost</Label>
              <Input
                id="ingredient_cost"
                type="number"
                min={0}
                step="0.01"
                value={form.unit_cost}
                placeholder="0.00"
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit_cost: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-0 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={handleSave}>
              {pending ? "Saving..." : "Add ingredient"}
            </Button>
          </DialogFooter>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
