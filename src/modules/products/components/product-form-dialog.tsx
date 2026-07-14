"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Category, Product, ProductPriceTier } from "@/lib/types";
import { listPriceTiersAction } from "@/modules/products/actions/price-tier.actions";
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
import { WholesalePriceTiersEditor } from "./wholesale-price-tiers-editor";
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
  last_unit_cost: z.number().min(0),
  is_active: z.boolean(),
  is_popular: z.boolean(),
  show_on_online_menu: z.boolean(),
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
  cost_unit: z.enum(MEASUREMENT_UNITS),
  units_per_purchase_unit: z.number().positive(),
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
  currency = "EGP",
  existingSkus = [],
}: ProductFormDialogProps) {
  const [workingProduct, setWorkingProduct] = useState<Product | null>(product ?? null);
  const [wholesaleTiers, setWholesaleTiers] = useState<ProductPriceTier[] | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const isEdit = Boolean(workingProduct);
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
      last_unit_cost: 0,
      is_active: true,
      is_popular: false,
      show_on_online_menu: true,
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
      cost_unit: "piece",
      units_per_purchase_unit: 1,
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

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setWorkingProduct(null);
      setWholesaleTiers(null);
      setActiveTab("details");
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened) setActiveTab("details");

    // Sync from the prop when opening / switching product. Do not wipe
    // workingProduct after create (product prop stays null until reopen).
    if (product) {
      setWorkingProduct((current) =>
        current?.id === product.id ? { ...current, ...product } : product
      );
      return;
    }
    if (justOpened) setWorkingProduct(null);
  }, [open, product]);

  useEffect(() => {
    if (!open) return;
    if (workingProduct) {
      form.reset({
        name: workingProduct.name,
        sku: workingProduct.sku,
        barcode: workingProduct.barcode,
        image_url: workingProduct.image_url,
        category_id: workingProduct.category_id,
        base_price: workingProduct.base_price,
        description: workingProduct.description,
        sale_price: workingProduct.sale_price,
        last_unit_cost: workingProduct.last_unit_cost ?? 0,
        is_active: workingProduct.is_active,
        is_popular: workingProduct.is_popular,
        show_on_online_menu: workingProduct.show_on_online_menu ?? true,
        track_inventory: workingProduct.track_inventory,
        product_type: workingProduct.product_type,
        inventory_tracking_mode: workingProduct.inventory_tracking_mode ?? "standard",
        inventory_rotation_method: workingProduct.inventory_rotation_method ?? "FIFO",
        expiry_policy: workingProduct.expiry_policy ?? "block_sale",
        expiry_tracking_enabled: workingProduct.expiry_tracking_enabled ?? false,
        shelf_life_value: workingProduct.shelf_life_value ?? 0,
        shelf_life_unit: workingProduct.shelf_life_unit ?? "days",
        unit: workingProduct.unit,
        base_unit: workingProduct.base_unit ?? workingProduct.unit,
        sale_unit: workingProduct.sale_unit,
        sales_unit_type: workingProduct.sales_unit_type,
        cost_unit: workingProduct.cost_unit ?? workingProduct.unit,
        units_per_purchase_unit: workingProduct.units_per_purchase_unit ?? 1,
        allow_fractional_quantity: workingProduct.allow_fractional_quantity,
        allow_price_input: workingProduct.allow_price_input,
        wholesale_enabled: workingProduct.wholesale_enabled,
      });
      return;
    }
    form.reset({
      name: "",
      sku: "",
      barcode: "",
      image_url: null,
      category_id: categories[0]?.id ?? "",
      base_price: 0,
      description: "",
      sale_price: null,
      last_unit_cost: 0,
      is_active: true,
      is_popular: false,
      show_on_online_menu: true,
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
      cost_unit: "piece",
      units_per_purchase_unit: 1,
      allow_fractional_quantity: false,
      allow_price_input: false,
      wholesale_enabled: false,
    });
    applyActivityTemplate("finished_product", "piece");
  }, [
    open,
    workingProduct,
    categories,
    form,
    applyActivityTemplate,
  ]);

  // Prefetch wholesale tiers as soon as product exists so the tab isn't empty-gated.
  useEffect(() => {
    if (!open || !workingProduct || !businessActivitySettings.enable_wholesale_sales) {
      setWholesaleTiers(null);
      return;
    }
    let cancelled = false;
    setWholesaleTiers([]);
    void listPriceTiersAction(workingProduct.id)
      .then((rows) => {
        if (!cancelled) {
          setWholesaleTiers(rows.filter((tier) => tier.sale_mode === "wholesale"));
        }
      })
      .catch(() => {
        if (!cancelled) setWholesaleTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workingProduct, businessActivitySettings.enable_wholesale_sales]);

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
    Boolean(workingProduct);
  const showVariantsTab =
    businessActivitySettings.enable_variants &&
    isEdit &&
    (productType === "finished_product" || productType === "finished") &&
    Boolean(workingProduct);
  const showWholesaleTiersTab =
    businessActivitySettings.enable_wholesale_sales && Boolean(workingProduct);

  async function onSubmit(values: ProductFormValues) {
    try {
      const payload = {
        ...values,
        cost_unit: values.cost_unit,
        units_per_purchase_unit: values.units_per_purchase_unit,
        last_unit_cost: values.last_unit_cost,
        image_url: values.image_url,
      };
      if (workingProduct) {
        const savedProduct = await updateProductAction(workingProduct.id, payload);
        if (imageFile && savedProduct) {
          const formData = new FormData();
          formData.append("image", imageFile);
          const imageUrl = await uploadProductImageAction(savedProduct.id, formData);
          setWorkingProduct({ ...savedProduct, image_url: imageUrl });
        } else if (savedProduct) {
          setWorkingProduct(savedProduct);
        }
        setImageFile(null);
        toast.success("تم تحديث المنتج");
        onSaved?.();
        return;
      }

      const savedProduct = await createProductAction(payload);
      let nextProduct = savedProduct;
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const imageUrl = await uploadProductImageAction(savedProduct.id, formData);
        nextProduct = { ...savedProduct, image_url: imageUrl };
      }
      setImageFile(null);
      setWorkingProduct(nextProduct);
      if (businessActivitySettings.enable_wholesale_sales) {
        setActiveTab("wholesale");
        toast.success("تم إنشاء المنتج — كمّل أسعار الجملة من التبويب");
      } else {
        toast.success("تم إنشاء المنتج");
      }
      onSaved?.();
    } catch {
      toast.error("تعذر حفظ المنتج");
    }
  }

  const showTabs = showVariantsTab || showRecipeTab || showWholesaleTiersTab;
  const detailsForm = (
    <GuidedProductDetailsForm
      form={form}
      categories={categories}
      isEdit={isEdit}
      currency={currency}
      activityType={businessActivitySettings.activity_type}
      enablePriceByAmount={businessActivitySettings.enable_price_by_amount}
      enableWholesaleSales={businessActivitySettings.enable_wholesale_sales}
      onCancel={() => onOpenChange(false)}
      onSubmit={onSubmit}
      onImageFileChange={setImageFile}
      onApplyActivityTemplate={!isEdit ? applyActivityTemplate : undefined}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setImageFile(null);
        onOpenChange(nextOpen);
      }}
    >
      <StandardModalContent
        size="lg"
        title={isEdit ? "تعديل منتج" : "منتج جديد"}
        description={
          businessActivitySettings.activity_type === "supermarket"
            ? "اسم، طريقة البيع، سعر الشراء وسعر البيع."
            : "عناصر المنيو والمكونات والأسعار والوصفات."
        }
        className="gap-5"
      >
        {showTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
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
              {showWholesaleTiersTab ? (
                <TabsTrigger value="wholesale" className="flex-1">
                  أسعار الجملة
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="details" className="outline-none">
              {detailsForm}
            </TabsContent>

            {showVariantsTab && workingProduct ? (
              <TabsContent value="variants" className="pt-1">
                <VariantEditor
                  product={workingProduct}
                  currency={currency}
                  recipesEnabled={recipesEnabled}
                />
              </TabsContent>
            ) : null}

            {showRecipeTab && workingProduct ? (
              <TabsContent value="recipe" className="pt-1">
                <RecipeEditor
                  product={workingProduct}
                  currency={currency}
                />
              </TabsContent>
            ) : null}

            {showWholesaleTiersTab && workingProduct ? (
              <TabsContent value="wholesale" className="pt-1">
                <WholesalePriceTiersEditor
                  key={workingProduct.id}
                  product={workingProduct}
                  currency={currency}
                  initialTiers={wholesaleTiers ?? []}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        ) : (
          detailsForm
        )}
      </StandardModalContent>
    </Dialog>
  );
}
