"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Category, MeasurementUnit, Product } from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { selectLabelById } from "@/lib/select-label";
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
import { SweetFormField } from "@/components/SweetFlow/form-field";
import { nextSequentialProductSku } from "@/modules/products/lib/generate-product-sku";
import {
  createCafeIngredientAction,
  saveCafeMenuItemAction,
  type CafeMenuItemInput,
} from "@/modules/products/actions/product.actions";
import { getRecipeAction } from "@/modules/products/actions/recipe.actions";
import { toast } from "sonner";

type RecipeLineDraft = CafeMenuItemInput["ingredients"][number];

type CafeMenuItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  ingredients: Product[];
  product?: Product | null;
  currency: string;
  recipesEnabled: boolean;
  existingSkus: string[];
  onSaved?: () => void;
};

const emptyLine = (): RecipeLineDraft => ({
  ingredient_product_id: "",
  quantity: 1,
  unit: "piece",
});

function convertRecipeQuantity(
  quantity: number,
  from: MeasurementUnit,
  to: MeasurementUnit
) {
  if (from === to) return quantity;
  if (from === "kg" && to === "gram") return quantity * 1000;
  if (from === "gram" && to === "kg") return quantity / 1000;
  if (from === "liter" && to === "ml") return quantity * 1000;
  if (from === "ml" && to === "liter") return quantity / 1000;
  return quantity;
}

export function CafeMenuItemDialog({
  open,
  onOpenChange,
  ...contentProps
}: CafeMenuItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <CafeMenuItemDialogContent
          key={contentProps.product?.id ?? "new"}
          onOpenChange={onOpenChange}
          {...contentProps}
        />
      ) : null}
    </Dialog>
  );
}

function CafeMenuItemDialogContent({
  onOpenChange,
  categories,
  ingredients,
  product,
  currency,
  recipesEnabled,
  existingSkus,
  onSaved,
}: Omit<CafeMenuItemDialogProps, "open">) {
  const [pending, startTransition] = useTransition();
  const [ingredientPending, startIngredientTransition] = useTransition();
  const isEdit = Boolean(product);
  const initialSku = product?.sku ?? nextSequentialProductSku(existingSkus);
  const [loadingRecipe, setLoadingRecipe] = useState(isEdit);
  const defaultIngredientCategoryId =
    ingredients[0]?.category_id ??
    categories.find((category) => /مكون|مكونات|ingredient|inventory|مخزون/i.test(category.name))?.id ??
    categories[0]?.id ??
    "";
  const [draft, setDraft] = useState(() => ({
    name: product?.name ?? "",
    category_id: product?.category_id ?? categories[0]?.id ?? "",
    sale_price: product ? String(product.base_price) : "",
    sku: initialSku,
    barcode: product?.barcode ?? initialSku,
  }));
  const [availableIngredients, setAvailableIngredients] = useState(ingredients);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    unit: "piece" as MeasurementUnit,
    unit_cost: "",
  });
  const [lines, setLines] = useState<RecipeLineDraft[]>([emptyLine()]);

  const ingredientMap = useMemo(
    () => new Map(availableIngredients.map((ingredient) => [ingredient.id, ingredient])),
    [availableIngredients]
  );

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    void getRecipeAction(product.id, null)
      .then((recipe) => {
        if (cancelled) return;
        setLines(
          recipe?.lines.length
            ? recipe.lines.map((line) => ({
                ingredient_product_id: line.ingredient_product_id,
                quantity: line.quantity,
                unit: line.unit,
              }))
            : [emptyLine()]
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load recipe");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  const salePrice = Number(draft.sale_price) || 0;
  const recipeCost = lines.reduce((sum, line) => {
    const ingredient = ingredientMap.get(line.ingredient_product_id);
    if (!ingredient || line.quantity <= 0) return sum;
    const costQuantity = convertRecipeQuantity(
      line.quantity,
      line.unit,
      ingredient.cost_unit
    );
    return sum + costQuantity * ingredient.last_unit_cost;
  }, 0);
  const profit = salePrice - recipeCost;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  function updateLine(index: number, patch: Partial<RecipeLineDraft>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      )
    );
  }

  function handleIngredientChange(index: number, ingredientId: string) {
    const ingredient = ingredientMap.get(ingredientId);
    updateLine(index, {
      ingredient_product_id: ingredientId,
      unit: ingredient?.unit ?? "piece",
    });
  }

  function handleSave() {
    if (!recipesEnabled) {
      toast.error("Recipes are disabled");
      return;
    }
    if (!draft.name.trim() || !draft.category_id || salePrice < 0) {
      toast.error("Name, category, and sale price are required");
      return;
    }
    const validLines = lines.filter(
      (line) => line.ingredient_product_id && line.quantity > 0
    );
    if (validLines.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }

    startTransition(async () => {
      try {
        await saveCafeMenuItemAction({
          productId: product?.id,
          name: draft.name,
          category_id: draft.category_id,
          sale_price: salePrice,
          sku: draft.sku,
          barcode: draft.barcode,
          ingredients: validLines,
        });
        toast.success(isEdit ? "Menu item updated" : "Menu item created");
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save menu item");
      }
    });
  }

  function handleCreateIngredient() {
    const name = newIngredient.name.trim();
    if (!name) {
      toast.error("Ingredient name is required");
      return;
    }
    if (!defaultIngredientCategoryId) {
      toast.error("Add an ingredient category first");
      return;
    }

    startIngredientTransition(async () => {
      try {
        const ingredient = await createCafeIngredientAction({
          name,
          category_id: defaultIngredientCategoryId,
          unit: newIngredient.unit,
          unit_cost: Number(newIngredient.unit_cost) || 0,
        });
        setAvailableIngredients((current) => [...current, ingredient]);
        setLines((current) => {
          const firstEmpty = current.findIndex((line) => !line.ingredient_product_id);
          if (firstEmpty === -1) {
            return [
              ...current,
              {
                ingredient_product_id: ingredient.id,
                quantity: 1,
                unit: ingredient.unit,
              },
            ];
          }
          return current.map((line, index) =>
            index === firstEmpty
              ? {
                  ...line,
                  ingredient_product_id: ingredient.id,
                  unit: ingredient.unit,
                }
              : line
          );
        });
        setNewIngredient({ name: "", unit: "piece", unit_cost: "" });
        toast.success("Ingredient added");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add ingredient");
      }
    });
  }

  return (
    <StandardModalContent
        size="xl"
        title={isEdit ? "Edit menu item" : "New menu item"}
        description="Simple steps: item details, price, then ingredients."
      >
        <div className="grid gap-5">
          {!recipesEnabled ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Recipes are disabled. Enable recipes before saving menu item ingredients.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SweetFormField id="menu_item_name" label="Item name">
                  <Input
                    id="menu_item_name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Cappuccino"
                  />
                </SweetFormField>
                <SweetFormField id="menu_item_category" label="Category">
                  <Select
                    value={draft.category_id}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, category_id: value ?? "" }))
                    }
                  >
                    <SelectTrigger id="menu_item_category">
                      <SelectValue placeholder="Choose category">
                        {(value) => selectLabelById(categories, value, (category) => category.name)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id} label={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SweetFormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SweetFormField id="menu_item_price" label={`Sale price (${currency})`}>
                  <Input
                    id="menu_item_price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.sale_price}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sale_price: event.target.value }))
                    }
                  />
                </SweetFormField>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Automatic setup</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SKU, barcode, POS visibility, and stock deduction are configured automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
              <p className="font-medium">Cost preview</p>
              <div className="mt-3 grid gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipe cost</span>
                  <span className="font-medium">{formatCurrency(recipeCost, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale price</span>
                  <span className="font-medium">{formatCurrency(salePrice, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="font-medium">{formatCurrency(profit, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-medium">{margin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium">Ingredients</h3>
                <p className="text-xs text-muted-foreground">
                  Choose existing ingredients or define a new one without leaving this screen.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setLines((current) => [...current, emptyLine()])}
              >
                <Plus className="size-4" />
                Add ingredient
              </Button>
            </div>

            <div className="grid gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_150px_140px_auto]">
              <div className="grid gap-1">
                <Label className="text-xs">New ingredient</Label>
                <Input
                  value={newIngredient.name}
                  placeholder="Milk, sugar, espresso beans..."
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Unit</Label>
                <Select
                  value={newIngredient.unit}
                  onValueChange={(value) =>
                    setNewIngredient((current) => ({
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
              <div className="grid gap-1">
                <Label className="text-xs">Unit cost</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newIngredient.unit_cost}
                  placeholder="0.00"
                  onChange={(event) =>
                    setNewIngredient((current) => ({
                      ...current,
                      unit_cost: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={ingredientPending || !newIngredient.name.trim()}
                  onClick={handleCreateIngredient}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </div>

            {loadingRecipe ? (
              <p className="text-sm text-muted-foreground">Loading recipe...</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_120px_140px_auto]"
                  >
                    <div className="grid gap-1">
                      <Label className="text-xs">Ingredient</Label>
                      <Select
                        value={line.ingredient_product_id}
                        onValueChange={(value) => handleIngredientChange(index, value ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ingredient">
                            {(value) =>
                              selectLabelById(
                                availableIngredients,
                                value,
                                (ingredient) => ingredient.name
                              )
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableIngredients.map((ingredient) => (
                            <SelectItem
                              key={ingredient.id}
                              value={ingredient.id}
                              label={ingredient.name}
                            >
                              {ingredient.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: Number(event.target.value) })
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={line.unit}
                        onValueChange={(value) =>
                          updateLine(index, { unit: (value ?? "piece") as MeasurementUnit })
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
                          {MEASUREMENT_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit} label={formatUnit(unit)}>
                              {formatUnit(unit)}
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
                        onClick={() =>
                          setLines((current) =>
                            current.length > 1
                              ? current.filter((_, lineIndex) => lineIndex !== index)
                              : current
                          )
                        }
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 px-0 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={pending || loadingRecipe || !recipesEnabled}
            >
              {pending ? "Saving..." : isEdit ? "Save menu item" : "Create menu item"}
            </Button>
          </DialogFooter>
        </div>
    </StandardModalContent>
  );
}
