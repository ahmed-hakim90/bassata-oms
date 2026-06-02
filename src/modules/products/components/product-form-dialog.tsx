"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Category, Product } from "@/lib/types";
import { MEASUREMENT_UNITS, PRODUCT_SALES_UNIT_TYPES, PRODUCT_TYPES } from "@/lib/constants";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createProductAction,
  updateProductAction,
} from "@/modules/products/actions/product.actions";
import { RecipeEditor } from "./recipe-editor";
import { VariantEditor } from "./variant-editor";
import { toast } from "sonner";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().min(1, "Barcode is required"),
  category_id: z.string().min(1, "Category is required"),
  base_price: z.number().min(0),
  description: z.string(),
  sale_price: z.number().min(0).nullable(),
  publish_to_souqna: z.boolean(),
  is_active: z.boolean(),
  is_popular: z.boolean(),
  track_inventory: z.boolean(),
  product_type: z.enum(["finished", "ingredient"]),
  unit: z.enum([
    "piece",
    "bag",
    "cup",
    "spoon",
    "gram",
    "kg",
    "ml",
    "liter",
  ]),
  sale_unit: z.enum([
    "piece",
    "bag",
    "cup",
    "spoon",
    "gram",
    "kg",
    "ml",
    "liter",
  ]),
  sales_unit_type: z.enum(["piece", "weight", "volume", "pack", "mixed"]),
  allow_fractional_quantity: z.boolean(),
  allow_price_input: z.boolean(),
  wholesale_enabled: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  product?: Product | null;
  recipesEnabled?: boolean;
  souqnaEnabled?: boolean;
  defaultPublishToSouqna?: boolean;
  onSaved?: () => void;
  currency?: string;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
  recipesEnabled = false,
  souqnaEnabled = false,
  defaultPublishToSouqna = false,
  onSaved,
  currency = "USD",
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      category_id: categories[0]?.id ?? "",
      base_price: 0,
      description: "",
      sale_price: null,
      publish_to_souqna: defaultPublishToSouqna,
      is_active: true,
      is_popular: false,
      track_inventory: true,
      product_type: "finished",
      unit: "piece",
      sale_unit: "piece",
      sales_unit_type: "piece",
      allow_fractional_quantity: false,
      allow_price_input: false,
      wholesale_enabled: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category_id: product.category_id,
        base_price: product.base_price,
        description: product.description,
        sale_price: product.sale_price,
        publish_to_souqna: product.publish_to_souqna,
        is_active: product.is_active,
        is_popular: product.is_popular,
        track_inventory: product.track_inventory,
        product_type: product.product_type,
        unit: product.unit,
        sale_unit: product.sale_unit,
        sales_unit_type: product.sales_unit_type,
        allow_fractional_quantity: product.allow_fractional_quantity,
        allow_price_input: product.allow_price_input,
        wholesale_enabled: product.wholesale_enabled,
      });
    } else {
      form.reset({
        name: "",
        sku: "",
        barcode: "",
        category_id: categories[0]?.id ?? "",
        base_price: 0,
        description: "",
        sale_price: null,
        publish_to_souqna: defaultPublishToSouqna,
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished",
        unit: "piece",
        sale_unit: "piece",
        sales_unit_type: "piece",
        allow_fractional_quantity: false,
        allow_price_input: false,
        wholesale_enabled: false,
      });
    }
  }, [open, product, categories, form, defaultPublishToSouqna]);

  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const productType = useWatch({ control: form.control, name: "product_type" });
  const unit = useWatch({ control: form.control, name: "unit" });
  const isActive = useWatch({ control: form.control, name: "is_active" });
  const isPopular = useWatch({ control: form.control, name: "is_popular" });
  const trackInventory = useWatch({ control: form.control, name: "track_inventory" });
  const publishToSouqna = useWatch({ control: form.control, name: "publish_to_souqna" });
  const salePrice = useWatch({ control: form.control, name: "sale_price" });
  const showRecipeTab =
    recipesEnabled && isEdit && productType === "finished" && Boolean(product);
  const showVariantsTab = isEdit && productType === "finished" && Boolean(product);

  async function onSubmit(values: ProductFormValues) {
    try {
      const payload = {
        ...values,
        cost_unit: values.unit,
        last_unit_cost: product?.last_unit_cost ?? 0,
        image_url: product?.image_url ?? null,
      };
      if (isEdit && product) {
        await updateProductAction(product.id, payload);
        toast.success("Product updated");
      } else {
        await createProductAction(payload);
        toast.success("Product created");
      }
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Could not save product");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Menu items, ingredients, pricing, and recipes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">
              Details
            </TabsTrigger>
            {showVariantsTab ? (
              <TabsTrigger value="variants" className="flex-1">
                Variants
              </TabsTrigger>
            ) : null}
            {showRecipeTab ? (
              <TabsTrigger value="recipe" className="flex-1">
                Recipe
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 pt-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select
                    value={productType}
                    onValueChange={(v) =>
                      form.setValue(
                        "product_type",
                        (v ?? "finished") as ProductFormValues["product_type"],
                        { shouldValidate: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value === "finished"
                            ? "Finished (POS)"
                            : value === "ingredient"
                              ? "Ingredient"
                              : null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          label={t === "finished" ? "Finished (POS)" : "Ingredient"}
                        >
                          {t === "finished" ? "Finished (POS)" : "Ingredient"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Unit</Label>
                  <Select
                    value={unit}
                    onValueChange={(v) =>
                      form.setValue(
                        "unit",
                        (v ?? "piece") as ProductFormValues["unit"],
                        { shouldValidate: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value ? formatUnit(value as ProductFormValues["unit"]) : null
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
                <div className="grid gap-2">
                  <Label>Sale unit type</Label>
                  <Select
                    value={form.watch("sales_unit_type")}
                    onValueChange={(v) =>
                      form.setValue(
                        "sales_unit_type",
                        (v ?? "piece") as ProductFormValues["sales_unit_type"],
                        { shouldValidate: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_SALES_UNIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} label={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Sale unit</Label>
                  <Select
                    value={form.watch("sale_unit")}
                    onValueChange={(v) =>
                      form.setValue("sale_unit", (v ?? "piece") as ProductFormValues["sale_unit"], {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEASUREMENT_UNITS.map((u) => (
                        <SelectItem key={u} value={u} label={u}>
                          {formatUnit(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["allow_fractional_quantity", "Allow fractional quantity"],
                    ["allow_price_input", "Allow price input"],
                    ["wholesale_enabled", "Wholesale enabled"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border p-3">
                    <Checkbox
                      checked={form.watch(key)}
                      onCheckedChange={(v) =>
                        form.setValue(key, v === true, { shouldValidate: true })
                      }
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" {...form.register("sku")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" {...form.register("barcode")} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) =>
                    form.setValue("category_id", v ?? "", { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category">
                      {(value) => selectLabelById(categories, value, (c) => c.name)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} label={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} {...form.register("description")} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="base_price">
                    {productType === "ingredient" ? "Reference price" : "Base price"}
                  </Label>
                  <Input
                    id="base_price"
                    type="number"
                    step="0.01"
                    {...form.register("base_price", { valueAsNumber: true })}
                  />
                </div>
                {productType === "finished" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="sale_price">Sale price (optional)</Label>
                    <Input
                      id="sale_price"
                      type="number"
                      step="0.01"
                      placeholder="No sale"
                      value={salePrice ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        form.setValue("sale_price", raw === "" ? null : Number(raw));
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(v) => form.setValue("is_active", Boolean(v))}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isPopular}
                    onCheckedChange={(v) => form.setValue("is_popular", Boolean(v))}
                  />
                  Popular
                </label>
                {souqnaEnabled && productType === "finished" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={publishToSouqna}
                      onCheckedChange={(v) =>
                        form.setValue("publish_to_souqna", Boolean(v))
                      }
                    />
                    نشر المنتج على سوقنا
                  </label>
                ) : null}
                {productType === "ingredient" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={trackInventory}
                      onCheckedChange={(v) =>
                        form.setValue("track_inventory", Boolean(v))
                      }
                    />
                    Track inventory
                  </label>
                ) : null}
              </div>

              <DialogFooter className="px-0 pb-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {isEdit ? "Save changes" : "Create product"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {showVariantsTab && product ? (
            <TabsContent value="variants" className="pt-2">
              <VariantEditor
                product={product}
                currency={currency}
                recipesEnabled={recipesEnabled}
              />
            </TabsContent>
          ) : null}

          {showRecipeTab && product ? (
            <TabsContent value="recipe" className="pt-2">
              <RecipeEditor
                product={product}
                currency={currency}
                onSaved={onSaved}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
