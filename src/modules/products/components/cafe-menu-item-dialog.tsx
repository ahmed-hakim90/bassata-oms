"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Category, MeasurementUnit, Product, ProductVariant } from "@/lib/types";
import { MEASUREMENT_UNITS } from "@/lib/constants";
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
  uploadProductImageAction,
  type CafeMenuItemInput,
} from "@/modules/products/actions/product.actions";
import { VariantEditor } from "@/modules/products/components/variant-editor";
import { toast } from "sonner";

type RecipeLineDraft = CafeMenuItemInput["ingredients"][number];
type NewVariantDraft = Omit<NonNullable<CafeMenuItemInput["variants"]>[number], "price"> & {
  key: string;
  price: string | number;
};

type CafeMenuItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  ingredients: Product[];
  product?: Product | null;
  initialVariants?: ProductVariant[];
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

const emptyVariant = (index = 1): NewVariantDraft => ({
  key: crypto.randomUUID(),
  name: index === 1 ? "صغير" : "",
  sku: "",
  barcode: "",
  price: "",
  ingredients: [emptyLine()],
});

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
  initialVariants = [],
  currency,
  recipesEnabled,
  existingSkus,
  onSaved,
}: Omit<CafeMenuItemDialogProps, "open">) {
  const [pending, startTransition] = useTransition();
  const [ingredientPending, startIngredientTransition] = useTransition();
  const isEdit = Boolean(product);
  const initialSku = product?.sku ?? nextSequentialProductSku(existingSkus);
  const [draft, setDraft] = useState(() => ({
    name: product?.name ?? "",
    category_id: product?.category_id ?? categories[0]?.id ?? "",
    sku: initialSku,
    barcode: product?.barcode ?? initialSku,
    image_url: product?.image_url ?? null,
  }));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState(ingredients);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    category_id: "",
    unit: "piece" as MeasurementUnit,
    unit_cost: "",
  });
  const [variantDrafts, setVariantDrafts] = useState<NewVariantDraft[]>([
    emptyVariant(1),
  ]);
  const [expandedVariantKey, setExpandedVariantKey] = useState<string | null>(null);

  const ingredientMap = useMemo(
    () => new Map(availableIngredients.map((ingredient) => [ingredient.id, ingredient])),
    [availableIngredients]
  );

  function updateVariant(index: number, patch: Partial<NewVariantDraft>) {
    setVariantDrafts((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant
      )
    );
  }

  function updateVariantLine(
    variantIndex: number,
    lineIndex: number,
    patch: Partial<RecipeLineDraft>
  ) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? {
              ...variant,
              ingredients: variant.ingredients.map((line, currentLineIndex) =>
                currentLineIndex === lineIndex ? { ...line, ...patch } : line
              ),
            }
          : variant
      )
    );
  }

  function handleVariantIngredientChange(
    variantIndex: number,
    lineIndex: number,
    ingredientId: string
  ) {
    const ingredient = ingredientMap.get(ingredientId);
    updateVariantLine(variantIndex, lineIndex, {
      ingredient_product_id: ingredientId,
      unit: ingredient?.unit ?? "piece",
    });
  }

  function addVariantLine(variantIndex: number) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? { ...variant, ingredients: [...variant.ingredients, emptyLine()] }
          : variant
      )
    );
  }

  function removeVariantLine(variantIndex: number, lineIndex: number) {
    setVariantDrafts((current) =>
      current.map((variant, currentVariantIndex) =>
        currentVariantIndex === variantIndex
          ? {
              ...variant,
              ingredients:
                variant.ingredients.length > 1
                  ? variant.ingredients.filter((_, currentLineIndex) => currentLineIndex !== lineIndex)
                  : variant.ingredients,
            }
          : variant
      )
    );
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.category_id) {
      toast.error("الاسم والتصنيف مطلوبان");
      return;
    }
    const validVariants = isEdit
      ? []
      : variantDrafts
          .map((variant) => ({
            name: variant.name.trim(),
            sku: variant.sku?.trim() ?? "",
            barcode: variant.barcode?.trim() ?? "",
            price: Number(variant.price) || 0,
            ingredients: variant.ingredients.filter(
              (line) => line.ingredient_product_id && line.quantity > 0
            ),
          }))
          .filter((variant) => variant.name && variant.price > 0);

    if (!isEdit && validVariants.length === 0) {
      toast.error("أضف حجمًا واحدًا على الأقل مع السعر");
      return;
    }
    const hasRecipeLines =
      validVariants.some((variant) => variant.ingredients.length > 0);
    if (!recipesEnabled && hasRecipeLines) {
      toast.error("الوصفات غير مفعّلة");
      return;
    }

    startTransition(async () => {
      try {
        await saveCafeMenuItemAction({
          productId: product?.id,
          name: draft.name,
          category_id: draft.category_id,
          sku: draft.sku,
          barcode: draft.barcode,
          image_url: draft.image_url,
          ingredients: [],
          variants: validVariants,
        }).then(async (savedProduct) => {
          if (!imageFile) return;
          const formData = new FormData();
          formData.append("image", imageFile);
          await uploadProductImageAction(savedProduct.id, formData);
        });
        toast.success(isEdit ? "تم تحديث صنف المنيو" : "تم إنشاء صنف المنيو");
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر حفظ صنف المنيو");
      }
    });
  }

  function handleCreateIngredient() {
    const name = newIngredient.name.trim();
    if (!name) {
      toast.error("اسم المكون مطلوب");
      return;
    }
    if (!newIngredient.category_id) {
      toast.error("اختار تصنيف المكون أولًا");
      return;
    }

    startIngredientTransition(async () => {
      try {
        const ingredient = await createCafeIngredientAction({
          name,
          category_id: newIngredient.category_id,
          unit: newIngredient.unit,
          unit_cost: Number(newIngredient.unit_cost) || 0,
        });
        setAvailableIngredients((current) => [...current, ingredient]);
        setVariantDrafts((current) => {
          const targetVariantIndex = current.findIndex((variant) =>
            variant.ingredients.some((line) => !line.ingredient_product_id)
          );
          const variantIndex = targetVariantIndex === -1 ? 0 : targetVariantIndex;
          return current.map((variant, currentVariantIndex) => {
            if (currentVariantIndex !== variantIndex) return variant;
            const firstEmpty = variant.ingredients.findIndex(
              (line) => !line.ingredient_product_id
            );
            if (firstEmpty === -1) {
              return {
                ...variant,
                ingredients: [
                  ...variant.ingredients,
                  {
                    ingredient_product_id: ingredient.id,
                    quantity: 1,
                    unit: ingredient.unit,
                  },
                ],
              };
            }
            return {
              ...variant,
              ingredients: variant.ingredients.map((line, lineIndex) =>
                lineIndex === firstEmpty
                  ? {
                      ...line,
                      ingredient_product_id: ingredient.id,
                      unit: ingredient.unit,
                    }
                  : line
              ),
            };
          });
        });
        setNewIngredient({ name: "", category_id: "", unit: "piece", unit_cost: "" });
        toast.success("تمت إضافة المكون");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إضافة المكون");
      }
    });
  }

  return (
      <StandardModalContent
        size="xl"
        title={isEdit ? "تعديل صنف المنيو" : "صنف منيو جديد"}
        description={
          isEdit
            ? "حدّث التفاصيل والأحجام والأسعار والوصفات الاختيارية."
            : "أنشئ الصنف ثم أضف الأحجام والأسعار. المكونات اختيارية."
        }
      >
        <div className="grid gap-5">
          {!recipesEnabled ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              الوصفات غير مفعّلة. فعّل الوصفات قبل حفظ مكونات أصناف المنيو.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SweetFormField id="menu_item_name" label="اسم الصنف">
                  <Input
                    id="menu_item_name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="كابتشينو"
                  />
                </SweetFormField>
                <SweetFormField id="menu_item_category" label="التصنيف">
                  <Select
                    value={draft.category_id}
                    onValueChange={(value) =>
                      setDraft((current) => ({ ...current, category_id: value ?? "" }))
                    }
                  >
                    <SelectTrigger id="menu_item_category">
                      <SelectValue placeholder="اختار التصنيف">
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

              <SweetFormField
                id="menu_item_image"
                label="صورة الصنف"
                hint="ارفع صورة من الجهاز أو اترك الرابط الحالي كما هو."
              >
                <div className="grid gap-2">
                  <Input
                    id="menu_item_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                  {draft.image_url ? (
                    <Input
                      value={draft.image_url}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          image_url: event.target.value || null,
                        }))
                      }
                      placeholder="رابط الصورة الحالي"
                    />
                  ) : null}
                </div>
              </SweetFormField>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">السعر من الأحجام</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    لن نطلب سعر عام للمنتج. السعر الظاهر سيأتي من أسعار الأحجام.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">إعداد تلقائي</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SKU والباركود وظهور نقطة البيع وخصم المخزون تُضبط تلقائيًا.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
              <p className="font-medium">تجهيز الأحجام</p>
              <p className="mt-2 text-xs text-muted-foreground">
                كل حجم له سعر مستقل. المكونات اختيارية وتقدر تضيفها الآن أو بعدين.
              </p>
            </div>
          </div>

          {!isEdit ? (
          <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium">الأحجام والأسعار والمكونات</h3>
                  <p className="text-xs text-muted-foreground">
                    كل حجم له سعر خاص به. المكونات اختيارية حالياً.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    setVariantDrafts((current) => [...current, emptyVariant(current.length + 1)])
                  }
                >
                  <Plus className="size-4" />
                  إضافة حجم
                </Button>
              </div>

              <div className="grid gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_180px_130px_120px_auto]">
                <div className="grid gap-1">
                  <Label className="text-xs">مكون جديد</Label>
                  <Input
                    value={newIngredient.name}
                    placeholder="حليب، سكر، بن إسبريسو..."
                    onChange={(event) =>
                      setNewIngredient((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">التصنيف</Label>
                  <Select
                    value={newIngredient.category_id}
                    onValueChange={(value) =>
                      setNewIngredient((current) => ({
                        ...current,
                        category_id: value ?? "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختار التصنيف">
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
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">الوحدة</Label>
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
                  <Label className="text-xs">تكلفة الوحدة</Label>
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
                    إضافة
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {variantDrafts.map((variant, variantIndex) => (
                  <div key={variant.key} className="space-y-3 rounded-xl border border-border/70 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_1fr_auto]">
                      <div className="grid gap-1">
                        <Label className="text-xs">الحجم</Label>
                        <Input
                          value={variant.name}
                          placeholder="صغير، وسط، كبير"
                          onChange={(event) =>
                            updateVariant(variantIndex, { name: event.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">السعر</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={variant.price}
                          onChange={(event) =>
                            updateVariant(variantIndex, { price: event.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">SKU</Label>
                        <Input
                          value={variant.sku ?? ""}
                          onChange={(event) =>
                            updateVariant(variantIndex, { sku: event.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">باركود</Label>
                        <Input
                          value={variant.barcode ?? ""}
                          onChange={(event) =>
                            updateVariant(variantIndex, { barcode: event.target.value })
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="حذف الحجم"
                          disabled={variantDrafts.length <= 1}
                          onClick={() =>
                            setVariantDrafts((current) =>
                              current.length > 1
                                ? current.filter((_, currentIndex) => currentIndex !== variantIndex)
                                : current
                            )
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {variant.ingredients.filter((line) => line.ingredient_product_id).length > 0
                            ? `${variant.ingredients.filter((line) => line.ingredient_product_id).length} مكونات`
                            : "مكونات اختيارية"}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedVariantKey((current) =>
                              current === variant.key ? null : variant.key
                            )
                          }
                        >
                          <Plus className="size-4" />
                          {expandedVariantKey === variant.key ? "إخفاء المكونات" : "فتح المكونات"}
                        </Button>
                      </div>
                      {expandedVariantKey === variant.key ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => addVariantLine(variantIndex)}
                        >
                          <Plus className="size-4" />
                          إضافة مكون
                        </Button>
                      ) : null}
                      {expandedVariantKey === variant.key ? variant.ingredients.map((line, lineIndex) => (
                        <div
                          key={`${variant.key}-${lineIndex}`}
                          className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_120px_140px_auto]"
                        >
                          <div className="grid gap-1">
                            <Label className="text-xs">المكون</Label>
                            <Select
                              value={line.ingredient_product_id}
                              onValueChange={(value) =>
                                handleVariantIngredientChange(
                                  variantIndex,
                                  lineIndex,
                                  value ?? ""
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختار المكون">
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
                            <Label className="text-xs">الكمية</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.quantity}
                              onChange={(event) =>
                                updateVariantLine(variantIndex, lineIndex, {
                                  quantity: Number(event.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs">الوحدة</Label>
                            <Select
                              value={line.unit}
                              onValueChange={(value) =>
                                updateVariantLine(variantIndex, lineIndex, {
                                  unit: (value ?? "piece") as MeasurementUnit,
                                })
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
                              aria-label="حذف المكون"
                              disabled={variant.ingredients.length <= 1}
                              onClick={() => removeVariantLine(variantIndex, lineIndex)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </div>
                      )) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isEdit && product ? (
            <div className="space-y-3 rounded-xl border border-border/70 p-4">
              <div>
                <h3 className="text-sm font-medium">الأحجام والأسعار</h3>
                <p className="text-xs text-muted-foreground">
                  أضف أحجام المنتج مثل صغير، وسط، كبير مع سعر وباركود لكل حجم.
                </p>
              </div>
              <VariantEditor
                product={product}
                initialVariants={initialVariants}
                currency={currency}
                recipesEnabled={recipesEnabled}
              />
            </div>
          ) : null}

          <DialogFooter className="gap-2 px-0 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={pending}
            >
              {pending ? "جاري الحفظ…" : isEdit ? "حفظ الصنف" : "إنشاء الصنف"}
            </Button>
          </DialogFooter>
        </div>
    </StandardModalContent>
  );
}
