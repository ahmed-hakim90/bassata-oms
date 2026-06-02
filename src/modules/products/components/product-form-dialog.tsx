"use client";

import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Category, Product } from "@/lib/types";
import {
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  MEASUREMENT_UNITS,
  PRODUCT_TYPES,
  type BusinessActivitySettings,
  type ProductTemplateSettings,
} from "@/lib/constants";
import {
  getTemplateFromSettings,
  productTemplateToFormValues,
} from "@/modules/products/lib/apply-product-template";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createProductAction,
  updateProductAction,
} from "@/modules/products/actions/product.actions";
import { RecipeEditor } from "./recipe-editor";
import { VariantEditor } from "./variant-editor";
import { GuidedProductDetailsForm } from "./guided-product-details-form";
import { toast } from "sonner";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().min(1, "Barcode is required"),
  image_url: z.string().nullable(),
  category_id: z.string().min(1, "Category is required"),
  base_price: z.number().min(0),
  description: z.string(),
  sale_price: z.number().min(0).nullable(),
  publish_to_souqna: z.boolean(),
  is_active: z.boolean(),
  is_popular: z.boolean(),
  track_inventory: z.boolean(),
  product_type: z.enum(PRODUCT_TYPES),
  inventory_tracking_mode: z.enum(INVENTORY_TRACKING_MODES),
  inventory_rotation_method: z.enum(INVENTORY_ROTATION_METHODS),
  expiry_policy: z.enum(EXPIRY_POLICIES),
  expiry_tracking_enabled: z.boolean(),
  shelf_life_days: z.number().int().min(0),
  shelf_life_months: z.number().int().min(0),
  shelf_life_years: z.number().int().min(0),
  unit: z.enum(MEASUREMENT_UNITS),
  sale_unit: z.enum(MEASUREMENT_UNITS),
  base_unit: z.enum(MEASUREMENT_UNITS),
  sales_unit_type: z.enum(["piece", "weight", "volume", "pack", "mixed"]),
  allow_fractional_quantity: z.boolean(),
  allow_price_input: z.boolean(),
  wholesale_enabled: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  product?: Product | null;
  recipesEnabled?: boolean;
  souqnaEnabled?: boolean;
  defaultPublishToSouqna?: boolean;
  productTemplates: ProductTemplateSettings;
  businessActivitySettings: BusinessActivitySettings;
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
  productTemplates,
  businessActivitySettings,
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
      image_url: null,
      category_id: categories[0]?.id ?? "",
      base_price: 0,
      description: "",
      sale_price: null,
      publish_to_souqna: defaultPublishToSouqna,
      is_active: true,
      is_popular: false,
      track_inventory: true,
      product_type: "finished_product",
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: false,
      shelf_life_days: 0,
      shelf_life_months: 0,
      shelf_life_years: 0,
      unit: "piece",
      base_unit: "piece",
      sale_unit: "piece",
      sales_unit_type: "piece",
      allow_fractional_quantity: false,
      allow_price_input: false,
      wholesale_enabled: false,
    },
  });

  const applyActivityTemplate = useCallback((
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"]
  ) => {
    const template = getTemplateFromSettings(
      productTemplates,
      businessActivitySettings.activity_type,
      productType,
      salesUnitType
    );
    const slice = productTemplateToFormValues(template);
    for (const [key, value] of Object.entries(slice)) {
      form.setValue(key as keyof ProductFormValues, value as never, { shouldValidate: true });
    }
  }, [businessActivitySettings.activity_type, form, productTemplates]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        image_url: product.image_url,
        category_id: product.category_id,
        base_price: product.base_price,
        description: product.description,
        sale_price: product.sale_price,
        publish_to_souqna: product.publish_to_souqna,
        is_active: product.is_active,
        is_popular: product.is_popular,
        track_inventory: product.track_inventory,
        product_type: product.product_type,
        inventory_tracking_mode: product.inventory_tracking_mode ?? "standard",
        inventory_rotation_method: product.inventory_rotation_method ?? "FIFO",
        expiry_policy: product.expiry_policy ?? "block_sale",
        expiry_tracking_enabled: product.expiry_tracking_enabled ?? false,
        shelf_life_days: product.shelf_life_days ?? 0,
        shelf_life_months: product.shelf_life_months ?? 0,
        shelf_life_years: product.shelf_life_years ?? 0,
        unit: product.unit,
        base_unit: product.base_unit ?? product.unit,
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
        image_url: null,
        category_id: categories[0]?.id ?? "",
        base_price: 0,
        description: "",
        sale_price: null,
        publish_to_souqna: defaultPublishToSouqna,
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished_product",
        inventory_tracking_mode: "standard",
        inventory_rotation_method: "FIFO",
        expiry_policy: "block_sale",
        expiry_tracking_enabled: false,
        shelf_life_days: 0,
        shelf_life_months: 0,
        shelf_life_years: 0,
        unit: "piece",
        base_unit: "piece",
        sale_unit: "piece",
        sales_unit_type: "piece",
        allow_fractional_quantity: false,
        allow_price_input: false,
        wholesale_enabled: false,
      });
      applyActivityTemplate("finished_product", "piece");
    }
  }, [
    open,
    product,
    categories,
    form,
    defaultPublishToSouqna,
    productTemplates,
    businessActivitySettings.activity_type,
    applyActivityTemplate,
  ]);

  const productType = useWatch({ control: form.control, name: "product_type" });
  const showRecipeTab =
    recipesEnabled &&
    isEdit &&
    (productType === "finished_product" || productType === "finished") &&
    Boolean(product);
  const showVariantsTab =
    isEdit && (productType === "finished_product" || productType === "finished") && Boolean(product);

  async function onSubmit(values: ProductFormValues) {
    try {
      const payload = {
        ...values,
        cost_unit: values.unit,
        last_unit_cost: product?.last_unit_cost ?? 0,
        image_url: values.image_url,
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
            <GuidedProductDetailsForm
              form={form}
              categories={categories}
              souqnaEnabled={souqnaEnabled}
              isEdit={isEdit}
              currency={currency}
              onCancel={() => onOpenChange(false)}
              onSubmit={form.handleSubmit(onSubmit)}
              onApplyActivityTemplate={!isEdit ? applyActivityTemplate : undefined}
            />
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
