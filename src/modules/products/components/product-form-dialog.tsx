"use client";

import { useCallback, useEffect, useState } from "react";
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
  SHELF_LIFE_UNITS,
  type BusinessActivitySettings,
  type ProductTemplateSettings,
} from "@/lib/constants";
import {
  getTemplateFromSettings,
  productTemplateToFormValues,
} from "@/modules/products/lib/apply-product-template";
import {
  Dialog,
} from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createProductAction,
  updateProductAction,
  uploadProductImageAction,
} from "@/modules/products/actions/product.actions";
import { RecipeEditor } from "./recipe-editor";
import { VariantEditor } from "./variant-editor";
import { GuidedProductDetailsForm } from "@/modules/products/components/guided-product-details-form";
import { nextSequentialProductSku } from "@/modules/products/lib/generate-product-sku";
import { toast } from "sonner";

const productSchema = z.object({
      name: z.string().min(1, "اسم المنتج مطلوب"),
      sku: z.string().min(1, "كود المنتج مطلوب"),
      barcode: z.string().min(1, "الباركود مطلوب"),
  image_url: z.string().nullable(),
      category_id: z.string().min(1, "التصنيف مطلوب"),
  base_price: z.number().min(0),
  description: z.string(),
  sale_price: z.number().min(0).nullable(),
  is_active: z.boolean(),
  is_popular: z.boolean(),
  track_inventory: z.boolean(),
  product_type: z.enum(PRODUCT_TYPES),
  inventory_tracking_mode: z.enum(INVENTORY_TRACKING_MODES),
  inventory_rotation_method: z.enum(INVENTORY_ROTATION_METHODS),
  expiry_policy: z.enum(EXPIRY_POLICIES),
  expiry_tracking_enabled: z.boolean(),
  shelf_life_value: z.number().int().min(0),
  shelf_life_unit: z.enum(SHELF_LIFE_UNITS),
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
  productTemplates: ProductTemplateSettings;
  businessActivitySettings: BusinessActivitySettings;
  onSaved?: () => void;
  currency?: string;
  existingSkus?: string[];
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
  recipesEnabled = false,
  productTemplates,
  businessActivitySettings,
  onSaved,
  currency = "USD",
  existingSkus = [],
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);
  const [imageFile, setImageFile] = useState<File | null>(null);

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
      is_active: true,
      is_popular: false,
      track_inventory: true,
      product_type: "finished_product",
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_policy: "block_sale",
      expiry_tracking_enabled: false,
      shelf_life_value: 0,
      shelf_life_unit: "days",
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
        is_active: product.is_active,
        is_popular: product.is_popular,
        track_inventory: product.track_inventory,
        product_type: product.product_type,
        inventory_tracking_mode: product.inventory_tracking_mode ?? "standard",
        inventory_rotation_method: product.inventory_rotation_method ?? "FIFO",
        expiry_policy: product.expiry_policy ?? "block_sale",
        expiry_tracking_enabled: product.expiry_tracking_enabled ?? false,
        shelf_life_value: product.shelf_life_value ?? 0,
        shelf_life_unit: product.shelf_life_unit ?? "days",
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
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished_product",
        inventory_tracking_mode: "standard",
        inventory_rotation_method: "FIFO",
        expiry_policy: "block_sale",
        expiry_tracking_enabled: false,
        shelf_life_value: 0,
        shelf_life_unit: "days",
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
    productTemplates,
    businessActivitySettings.activity_type,
    applyActivityTemplate,
  ]);

  const productType = useWatch({ control: form.control, name: "product_type" });

  useEffect(() => {
    if (!open || isEdit) return;
    const sku = nextSequentialProductSku(existingSkus);
    form.setValue("sku", sku, { shouldValidate: false });
    form.setValue("barcode", sku, { shouldValidate: false });
  }, [open, isEdit, existingSkus, form]);

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
        cost_unit: values.base_unit,
        last_unit_cost: product?.last_unit_cost ?? 0,
        image_url: values.image_url,
      };
      if (isEdit && product) {
        const savedProduct = await updateProductAction(product.id, payload);
        if (imageFile && savedProduct) {
          const formData = new FormData();
          formData.append("image", imageFile);
          await uploadProductImageAction(savedProduct.id, formData);
        }
        toast.success("تم تحديث المنتج");
      } else {
        const savedProduct = await createProductAction(payload);
        if (imageFile) {
          const formData = new FormData();
          formData.append("image", imageFile);
          await uploadProductImageAction(savedProduct.id, formData);
        }
        toast.success("تم إنشاء المنتج");
      }
      setImageFile(null);
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("تعذر حفظ المنتج");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setImageFile(null);
        onOpenChange(nextOpen);
      }}
    >
      <StandardModalContent
        size="md"
        title={isEdit ? "تعديل منتج" : "منتج جديد"}
        description="عناصر المنيو والمكونات والأسعار والوصفات."
      >

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">
              التفاصيل
            </TabsTrigger>
            {showVariantsTab ? (
              <TabsTrigger value="variants" className="flex-1">
                الخيارات
              </TabsTrigger>
            ) : null}
            {showRecipeTab ? (
              <TabsTrigger value="recipe" className="flex-1">
                الوصفة
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="details">
            <GuidedProductDetailsForm
              form={form}
              categories={categories}
              isEdit={isEdit}
              currency={currency}
              activityType={businessActivitySettings.activity_type}
              onCancel={() => onOpenChange(false)}
              onSubmit={onSubmit}
              onImageFileChange={setImageFile}
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
      </StandardModalContent>
    </Dialog>
  );
}
