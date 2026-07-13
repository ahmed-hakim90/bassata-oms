"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  MEASUREMENT_UNITS,
  PRODUCT_TYPES,
  SHELF_LIFE_UNITS,
  type BusinessActivityType,
} from "@/lib/constants";
import {
  EXPIRY_POLICY_LABELS,
  INVENTORY_ROTATION_METHOD_LABELS,
  INVENTORY_TRACKING_MODE_LABELS,
  SHELF_LIFE_UNIT_LABELS,
  labelProductType,
} from "@/lib/labels/inventory";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import type { Category } from "@/lib/types";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { SweetFormField } from "@/components/SweetFlow/form-field";
import { getVisibleAdvancedSettingsForProduct } from "@/modules/products/lib/advanced-settings-visibility";
import {
  getFirstProductFormErrorStep,
  getProductFormFieldsForStep,
} from "@/modules/products/lib/product-form-steps";
import type { ProductFormValues } from "@/modules/products/components/product-form-dialog";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categories: Category[];
  isEdit: boolean;
  currency: string;
  activityType: BusinessActivityType;
  enablePriceByAmount?: boolean;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
  onImageFileChange?: (file: File | null) => void;
  onApplyActivityTemplate?: (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"]
  ) => void;
};

const STEP_TITLES = ["البيانات الأساسية", "نوع المنتج", "التسعير", "المخزون"] as const;
const SUPERMARKET_STEP_TITLES = ["البيانات الأساسية", "طريقة البيع", "الأسعار", "مراجعة"] as const;

const PRODUCT_TYPE_CHOICES: Array<{
  id: ProductFormValues["product_type"];
  label: string;
  hint: string;
  salesUnitType?: ProductFormValues["sales_unit_type"];
}> = [
  { id: "finished_product", label: "منتج بيع مباشر", hint: "منتج جاهز للبيع" },
  { id: "finished", label: "منتج وزني", hint: "يُسعّر حسب الوزن أو الكمية" },
  { id: "ingredient", label: "مكوّن", hint: "يُستخدم في تحضير الوصفات" },
  { id: "packaging_material", label: "مواد تعبئة", hint: "أكواب وملاعق وعلب وأكياس" },
  { id: "service", label: "خدمة", hint: "خدمة بدون مخزون" },
];

/** Supermarket: keep only the two everyday choices; rare types stay in advanced. */
const SUPERMARKET_PRODUCT_TYPE_CHOICES: Array<{
  id: ProductFormValues["product_type"];
  label: string;
  hint: string;
  salesUnitType: ProductFormValues["sales_unit_type"];
}> = [
  {
    id: "finished_product",
    label: "بالقطعة",
    hint: "مياه، بقالة، معلبات…",
    salesUnitType: "piece",
  },
  {
    id: "finished_product",
    label: "بالكيلو",
    hint: "خضار، جبنة، لحوم…",
    salesUnitType: "weight",
  },
];

function supermarketSellLabel(salesUnitType: ProductFormValues["sales_unit_type"]): string {
  return salesUnitType === "weight" ? "بالكيلو" : "بالقطعة";
}

const SUPERMARKET_PURCHASE_UNITS = [
  { id: "piece" as const, label: "بالقطعة", hint: "بشتري قطعة زي ما ببيع" },
  { id: "carton" as const, label: "بالكرتونة", hint: "بشتري كرتونة وفيها قطع" },
  { id: "pack" as const, label: "بالعلبة", hint: "بشتري علبة وفيها قطع" },
  { id: "box" as const, label: "بالصندوق", hint: "بشتري صندوق وفيه قطع" },
];

export function GuidedProductDetailsForm({
  form,
  categories,
  isEdit,
  currency,
  activityType,
  enablePriceByAmount = false,
  onSubmit,
  onCancel,
  onImageFileChange,
  onApplyActivityTemplate,
}: Props) {
  const [step, setStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reapplyDialogOpen, setReapplyDialogOpen] = useState(false);
  const [pendingTemplateReapply, setPendingTemplateReapply] = useState<{
    productType: ProductFormValues["product_type"];
    salesUnitType?: ProductFormValues["sales_unit_type"];
  } | null>(null);
  const values = form.watch();
  const errors = form.formState.errors;
  const visibleAdvancedSettings = getVisibleAdvancedSettingsForProduct(
    activityType,
    values.product_type,
    values.sales_unit_type
  );
  const showInventoryTracking = visibleAdvancedSettings.has("inventory_tracking");
  const showBatchTracking = visibleAdvancedSettings.has("batch_tracking");
  const showExpiryTracking = visibleAdvancedSettings.has("expiry_tracking");
  const showFefo = visibleAdvancedSettings.has("fefo");
  const showFractionalQuantity = visibleAdvancedSettings.has("fractional_quantity");
  const showPriceByAmount = enablePriceByAmount;
  const isSupermarket = activityType === "supermarket";
  const stepTitles = isSupermarket ? SUPERMARKET_STEP_TITLES : STEP_TITLES;
  const productTypeChoices = isSupermarket ? SUPERMARKET_PRODUCT_TYPE_CHOICES : PRODUCT_TYPE_CHOICES;
  const showWholesale = false;
  const showSerialNumber = false;
  const baseUnit = values.base_unit ?? values.unit;
  const purchasePackUnit =
    isSupermarket &&
    values.sales_unit_type === "piece" &&
    values.cost_unit !== baseUnit &&
    (values.cost_unit === "carton" ||
      values.cost_unit === "pack" ||
      values.cost_unit === "box")
      ? values.cost_unit
      : null;
  const salesUnitChoices = [
    { id: "piece" as const, label: "منتج بيع مباشر" },
    { id: "weight" as const, label: "منتج وزني" },
    { id: "volume" as const, label: "مكوّن" },
    { id: "pack" as const, label: "مواد تعبئة" },
  ];

  /** Only fields the activity template overwrites — not name/prices/purchase packing. */
  const TEMPLATE_OWNED_FIELDS = new Set<keyof ProductFormValues>([
    "unit",
    "base_unit",
    "sale_unit",
    "inventory_tracking_mode",
    "inventory_rotation_method",
    "expiry_policy",
    "expiry_tracking_enabled",
    "shelf_life_value",
    "shelf_life_unit",
    "allow_fractional_quantity",
    "allow_price_input",
    "track_inventory",
    "wholesale_enabled",
  ]);

  const shouldConfirmTemplateReapply = () => {
    if (!onApplyActivityTemplate) return false;
    // Supermarket path: silent defaults; never interrupt with "template" jargon.
    if (isSupermarket) return false;
    const dirty = form.formState.dirtyFields as Partial<
      Record<keyof ProductFormValues, boolean>
    >;
    return [...TEMPLATE_OWNED_FIELDS].some((field) => dirty[field]);
  };

  const requestTemplateReapply = (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"]
  ) => {
    if (!onApplyActivityTemplate) return;
    if (shouldConfirmTemplateReapply()) {
      setPendingTemplateReapply({ productType, salesUnitType });
      setReapplyDialogOpen(true);
      return;
    }
    onApplyActivityTemplate(productType, salesUnitType);
  };

  const trackingModes = INVENTORY_TRACKING_MODES.filter((mode) => {
    if (mode === "batch" && !showBatchTracking) return false;
    if (mode === "batch_and_expiry" && !(showBatchTracking && showExpiryTracking)) return false;
    if (mode === "serial_number" && !showSerialNumber) return false;
    return true;
  });

  const rotationMethods = INVENTORY_ROTATION_METHODS.filter((method) => {
    if (method === "FEFO" && !showFefo) return false;
    return true;
  });

  const validateStep = async (targetStep: number) => {
    const fields = getProductFormFieldsForStep(targetStep);
    if (fields.length === 0) return true;
    return form.trigger(fields);
  };

  const goToStep = async (target: number) => {
    if (target <= step) {
      setStep(target);
      return;
    }
    const isValid = await validateStep(step);
    if (!isValid) return;
    setStep(target);
  };

  const handleFormSubmit = form.handleSubmit(onSubmit, (fieldErrors) => {
    const errorStep = getFirstProductFormErrorStep(fieldErrors);
    if (errorStep !== undefined) setStep(errorStep);
    const firstField = Object.keys(fieldErrors)[0] as keyof ProductFormValues | undefined;
    if (firstField) void form.setFocus(firstField);
  });

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
      <nav aria-label="خطوات تعريف المنتج" className="flex gap-1.5">
        {stepTitles.map((title, idx) => {
          const active = step === idx + 1;
          return (
            <button
              key={title}
              type="button"
              aria-current={active ? "step" : undefined}
              className={`min-w-0 flex-1 rounded-xl px-2 py-2.5 text-center transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => {
                void goToStep(idx + 1);
              }}
            >
              <span className="block text-[10px] font-medium tabular-nums opacity-80">
                {idx + 1}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight sm:text-xs">
                {title}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-h-[14rem] space-y-4">
      {step === 1 ? (
        <div className="space-y-4">
          <SweetFormField id="name" label="اسم المنتج" error={errors.name?.message}>
            <Input
              id="name"
              aria-invalid={!!errors.name}
              {...form.register("name")}
            />
          </SweetFormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <SweetFormField id="category_id" label="التصنيف" error={errors.category_id?.message}>
              <Select
                value={values.category_id}
                onValueChange={(v) =>
                  form.setValue("category_id", v ?? "", { shouldValidate: true })
                }
              >
                <SelectTrigger aria-invalid={!!errors.category_id}>
                  <SelectValue placeholder="اختر التصنيف">
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
            </SweetFormField>
            <SweetFormField
              id="product_code"
              label={isSupermarket ? "الباركود" : "كود المنتج / الباركود"}
              hint={isEdit ? undefined : "يُنشأ تلقائياً"}
            >
              <Input
                id="product_code"
                readOnly
                value={values.sku || "—"}
                className="bg-muted/50"
              />
            </SweetFormField>
          </div>
          <SweetFormField
            id="image_upload"
            label="صورة المنتج"
            hint="ارفع صورة من الجهاز. يمكن أيضاً استخدام رابط صورة مباشر."
            error={errors.image_url?.message}
          >
            <div className="grid gap-2">
              <Input
                id="image_upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => onImageFileChange?.(e.target.files?.[0] ?? null)}
              />
              <Input
                id="image_url"
                aria-invalid={!!errors.image_url}
                value={values.image_url ?? ""}
                onChange={(e) => form.setValue("image_url", e.target.value || null)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </SweetFormField>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <SweetFormField
            id="product_type"
            label={isSupermarket ? "بتبيع إزاي؟" : "نوع المنتج"}
            error={errors.product_type?.message}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {productTypeChoices.map((item) => {
                const salesUnitType = item.salesUnitType ?? values.sales_unit_type;
                const selected =
                  values.product_type === item.id &&
                  (!isSupermarket || values.sales_unit_type === salesUnitType);
                return (
                  <button
                    key={`${item.id}-${item.salesUnitType ?? item.id}`}
                    type="button"
                    className={`rounded-xl border p-3 text-left ${selected ? "border-primary bg-primary/10" : "border-border/60"} ${errors.product_type ? "border-destructive ring-3 ring-destructive/20" : ""}`}
                    onClick={() => {
                      const unchanged =
                        values.product_type === item.id &&
                        (!isSupermarket || values.sales_unit_type === salesUnitType);
                      if (unchanged) return;

                      form.setValue("product_type", item.id, { shouldValidate: true });
                      if (isSupermarket && item.salesUnitType) {
                        form.setValue("sales_unit_type", item.salesUnitType, {
                          shouldValidate: true,
                        });
                        if (item.salesUnitType !== "piece") {
                          form.setValue("cost_unit", baseUnit, { shouldValidate: true });
                          form.setValue("units_per_purchase_unit", 1, { shouldValidate: true });
                        }
                        requestTemplateReapply(item.id, item.salesUnitType);
                      } else {
                        requestTemplateReapply(item.id, values.sales_unit_type);
                      }
                    }}
                  >
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.hint}</div>
                  </button>
                );
              })}
            </div>
          </SweetFormField>
          {!isSupermarket ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SweetFormField
                id="sales_unit_type"
                label="طريقة البيع"
                error={errors.sales_unit_type?.message}
              >
                <Select
                  value={values.sales_unit_type}
                  onValueChange={(v) => {
                    const nextSales = (v ?? "piece") as ProductFormValues["sales_unit_type"];
                    form.setValue("sales_unit_type", nextSales, { shouldValidate: true });
                    requestTemplateReapply(values.product_type, nextSales);
                  }}
                >
                  <SelectTrigger aria-invalid={!!errors.sales_unit_type}>
                    <SelectValue>
                      {(value) =>
                        salesUnitChoices.find((u) => u.id === value)?.label ?? null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {salesUnitChoices.map((u) => (
                      <SelectItem key={u.id} value={u.id} label={u.label}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SweetFormField>
              <SweetFormField id="sale_unit" label="وحدة المخزون">
                <Select
                  value={values.sale_unit}
                  onValueChange={(v) =>
                    form.setValue(
                      "sale_unit",
                      (v ?? "piece") as ProductFormValues["sale_unit"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value ? formatUnit(value as ProductFormValues["sale_unit"]) : null
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
              </SweetFormField>
            </div>
          ) : null}
          {isSupermarket &&
          values.sales_unit_type === "piece" &&
          (values.product_type === "finished_product" ||
            values.product_type === "finished") ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="text-sm font-medium">بتشتري إزاي من المورد؟</div>
              <div className="text-xs text-muted-foreground">
                البيع بالقطعة — واختيار الشراء لوحده: قطعة أو كرتونة / علبة / صندوق.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUPERMARKET_PURCHASE_UNITS.map((option) => {
                  const selected =
                    option.id === "piece"
                      ? !purchasePackUnit
                      : values.cost_unit === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`rounded-xl border p-3 text-right ${selected ? "border-primary bg-primary/10" : "border-border/60"}`}
                      onClick={() => {
                        if (option.id === "piece") {
                          form.setValue("cost_unit", baseUnit, { shouldValidate: true });
                          form.setValue("units_per_purchase_unit", 1, {
                            shouldValidate: true,
                          });
                          return;
                        }
                        form.setValue("cost_unit", option.id, { shouldValidate: true });
                        form.setValue(
                          "units_per_purchase_unit",
                          Math.max(2, values.units_per_purchase_unit || 24),
                          { shouldValidate: true }
                        );
                      }}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.hint}</div>
                    </button>
                  );
                })}
              </div>
              {purchasePackUnit ? (
                <SweetFormField
                  id="units_per_purchase_unit"
                  label={`كام قطعة في ال${formatUnit(purchasePackUnit)}؟`}
                  hint="مثال: 24"
                  error={errors.units_per_purchase_unit?.message}
                >
                  <Input
                    id="units_per_purchase_unit"
                    type="number"
                    min={2}
                    step={1}
                    aria-invalid={!!errors.units_per_purchase_unit}
                    {...form.register("units_per_purchase_unit", { valueAsNumber: true })}
                  />
                </SweetFormField>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {isSupermarket ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SweetFormField
                id="last_unit_cost"
                label="سعر الشراء"
                error={errors.last_unit_cost?.message}
              >
                <Input
                  id="last_unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  aria-invalid={!!errors.last_unit_cost}
                  {...form.register("last_unit_cost", { valueAsNumber: true })}
                />
              </SweetFormField>
              <SweetFormField
                id="base_price"
                label={
                  values.sales_unit_type === "weight" ? "سعر البيع / الكيلو" : "سعر البيع"
                }
                error={errors.base_price?.message}
              >
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  min="0"
                  aria-invalid={!!errors.base_price}
                  {...form.register("base_price", { valueAsNumber: true })}
                />
              </SweetFormField>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <SweetFormField
                id="base_price"
                label="سعر التكلفة"
                error={errors.base_price?.message}
              >
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  aria-invalid={!!errors.base_price}
                  {...form.register("base_price", { valueAsNumber: true })}
                />
              </SweetFormField>
              <SweetFormField
                id="sale_price"
                label="سعر البيع"
                error={errors.sale_price?.message}
              >
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  aria-invalid={!!errors.sale_price}
                  value={values.sale_price ?? ""}
                  onChange={(e) =>
                    form.setValue(
                      "sale_price",
                      e.target.value === "" ? null : Number(e.target.value),
                      { shouldValidate: true }
                    )
                  }
                />
              </SweetFormField>
            </div>
          )}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 p-3 text-sm">
            <div className="font-medium">{values.name || "منتج بدون اسم"}</div>
            <div className="text-muted-foreground">
              {isSupermarket ? (
                <>
                  {supermarketSellLabel(values.sales_unit_type)}
                  {purchasePackUnit
                    ? ` · شراء ${formatUnit(purchasePackUnit)} فيها ${values.units_per_purchase_unit} قطعة`
                    : " · شراء بالقطعة"}
                  {" · "}
                  شراء {values.last_unit_cost} · بيع {values.base_price} {currency}
                </>
              ) : (
                <>
                  النوع {labelProductType(values.product_type)} |{" "}
                  التكلفة {values.base_price} {currency}
                </>
              )}
            </div>
          </div>
          <SweetFormField id="description" label="الوصف">
            <Textarea id="description" rows={3} {...form.register("description")} />
          </SweetFormField>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.is_active} onCheckedChange={(v) => form.setValue("is_active", Boolean(v))} />
              نشط
            </label>
            {(values.product_type === "finished" ||
              values.product_type === "finished_product") && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.show_on_online_menu}
                  onCheckedChange={(v) => form.setValue("show_on_online_menu", v === true)}
                />
                يظهر في {isSupermarket ? "البيع أونلاين" : "منيو الأونلاين"}
              </label>
            )}
            {showInventoryTracking ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={values.track_inventory} onCheckedChange={(v) => form.setValue("track_inventory", Boolean(v))} />
                  تتبّع المخزون
                </label>
                {showExpiryTracking ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={values.expiry_tracking_enabled} onCheckedChange={(v) => form.setValue("expiry_tracking_enabled", v === true)} />
                    تتبّع الصلاحية
                  </label>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>

      <div className="rounded-xl border border-border/60 px-3 py-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-between text-start text-sm font-medium"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <span>إعدادات متقدمة</span>
          {advancedOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          {showInventoryTracking ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>طريقة التتبع</Label>
                <Select value={values.inventory_tracking_mode} onValueChange={(v) => form.setValue("inventory_tracking_mode", (v ?? "standard") as ProductFormValues["inventory_tracking_mode"], { shouldValidate: true })}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value
                          ? INVENTORY_TRACKING_MODE_LABELS[
                              value as ProductFormValues["inventory_tracking_mode"]
                            ]
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {trackingModes.map((mode) => (
                      <SelectItem
                        key={mode}
                        value={mode}
                        label={INVENTORY_TRACKING_MODE_LABELS[mode]}
                      >
                        {INVENTORY_TRACKING_MODE_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>ترتيب صرف المخزون</Label>
                <Select value={values.inventory_rotation_method} onValueChange={(v) => form.setValue("inventory_rotation_method", (v ?? "FIFO") as ProductFormValues["inventory_rotation_method"], { shouldValidate: true })}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value
                          ? INVENTORY_ROTATION_METHOD_LABELS[
                              value as ProductFormValues["inventory_rotation_method"]
                            ]
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rotationMethods.map((method) => (
                      <SelectItem
                        key={method}
                        value={method}
                        label={INVENTORY_ROTATION_METHOD_LABELS[method]}
                      >
                        {INVENTORY_ROTATION_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          {showExpiryTracking ? (
            <>
              <label className="flex items-center gap-2 rounded-xl border p-3">
                <Checkbox checked={values.expiry_tracking_enabled} onCheckedChange={(v) => form.setValue("expiry_tracking_enabled", v === true)} />
                <span className="text-sm">تتبّع تاريخ الصلاحية</span>
              </label>
              {values.expiry_tracking_enabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>مدة الصلاحية</Label>
                    <Input
                      type="number"
                      min={0}
                      {...form.register("shelf_life_value", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>وحدة المدة</Label>
                    <Select
                      value={values.shelf_life_unit ?? "days"}
                      onValueChange={(v) =>
                        form.setValue(
                          "shelf_life_unit",
                          (v ?? "days") as ProductFormValues["shelf_life_unit"],
                          { shouldValidate: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(value) =>
                            value
                              ? SHELF_LIFE_UNIT_LABELS[
                                  value as ProductFormValues["shelf_life_unit"]
                                ]
                              : null
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SHELF_LIFE_UNITS.map((unit) => (
                          <SelectItem
                            key={unit}
                            value={unit}
                            label={SHELF_LIFE_UNIT_LABELS[unit]}
                          >
                            {SHELF_LIFE_UNIT_LABELS[unit]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>عند انتهاء الصلاحية</Label>
                <Select value={values.expiry_policy} onValueChange={(v) => form.setValue("expiry_policy", (v ?? "block_sale") as ProductFormValues["expiry_policy"])}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value
                          ? EXPIRY_POLICY_LABELS[value as ProductFormValues["expiry_policy"]]
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_POLICIES.map((policy) => (
                      <SelectItem
                        key={policy}
                        value={policy}
                        label={EXPIRY_POLICY_LABELS[policy]}
                      >
                        {EXPIRY_POLICY_LABELS[policy]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          {showFractionalQuantity ? (
            <label className="flex items-center gap-2 rounded-xl border p-2">
              <Checkbox checked={values.allow_fractional_quantity} onCheckedChange={(v) => form.setValue("allow_fractional_quantity", v === true)} />
              <span className="text-xs">السماح ببيع كسور (مثلاً نصف كيلو)</span>
            </label>
          ) : null}
          {showPriceByAmount || showWholesale || showSerialNumber ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {showPriceByAmount || showSerialNumber ? (
                <label className="flex items-center gap-2 rounded-xl border p-2">
                  <Checkbox checked={values.allow_price_input} onCheckedChange={(v) => form.setValue("allow_price_input", v === true)} />
                  <span className="text-xs">
                    {showPriceByAmount && showSerialNumber
                      ? "رقم تسلسلي / سعر حسب المبلغ"
                      : showPriceByAmount
                        ? "بيع بالمبلغ (مش بالوزن فقط)"
                        : "رقم تسلسلي"}
                  </span>
                </label>
              ) : null}
              {showWholesale ? (
                <label className="flex items-center gap-2 rounded-xl border p-2">
                  <Checkbox checked={values.wholesale_enabled} onCheckedChange={(v) => form.setValue("wholesale_enabled", v === true)} />
                  <span className="text-xs">جملة</span>
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{isSupermarket ? "نوع نادر (تعبئة / خدمة…)" : "نوع المنتج (متقدم)"}</Label>
              <Select value={values.product_type} onValueChange={(v) => {
                const nextType = (v ?? "finished_product") as ProductFormValues["product_type"];
                form.setValue("product_type", nextType, { shouldValidate: true });
                requestTemplateReapply(nextType, values.sales_unit_type);
              }}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value
                        ? labelProductType(value as ProductFormValues["product_type"])
                        : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(isSupermarket
                    ? PRODUCT_TYPES.filter((t) => t !== "ingredient" && t !== "raw_material")
                    : PRODUCT_TYPES
                  ).map((t) => (
                    <SelectItem
                      key={t}
                      value={t}
                      label={labelProductType(t)}
                    >
                      {labelProductType(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{isSupermarket ? "وحدة التخزين" : "وحدة الأساس (متقدم)"}</Label>
              <Select value={values.base_unit} onValueChange={(v) => form.setValue("base_unit", (v ?? "piece") as ProductFormValues["base_unit"], { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value ? formatUnit(value as ProductFormValues["base_unit"]) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} label={formatUnit(u)}>{formatUnit(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isSupermarket ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>وحدة البيع</Label>
                <Select
                  value={values.sale_unit}
                  onValueChange={(v) =>
                    form.setValue(
                      "sale_unit",
                      (v ?? "piece") as ProductFormValues["sale_unit"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value ? formatUnit(value as ProductFormValues["sale_unit"]) : null
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
                <Label>وحدة الشراء</Label>
                <Select
                  value={values.cost_unit}
                  onValueChange={(v) => {
                    const next = (v ?? "piece") as ProductFormValues["cost_unit"];
                    form.setValue("cost_unit", next, { shouldValidate: true });
                    if (next === baseUnit) {
                      form.setValue("units_per_purchase_unit", 1, { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value ? formatUnit(value as ProductFormValues["cost_unit"]) : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(["piece", "carton", "pack", "box", "kg"] as const).map((u) => (
                      <SelectItem key={u} value={u} label={formatUnit(u)}>
                        {formatUnit(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
          رجوع
        </Button>
        <Button type="button" variant="outline" disabled={step === 4} onClick={() => { void goToStep(Math.min(4, step + 1)); }}>
          التالي
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isEdit ? "حفظ التعديلات" : "إنشاء المنتج"}
        </Button>
      </div>
      <ConfirmActionDialog
        open={reapplyDialogOpen}
        onOpenChange={setReapplyDialogOpen}
        title="تغيير نوع المنتج؟"
        description="بعض إعدادات المخزون والصلاحية هترجع للقيم الافتراضية للنوع الجديد. الاسم والأسعار مش هتتأثر."
        confirmLabel="متابعة"
        onConfirm={() => {
          if (!pendingTemplateReapply) return;
          onApplyActivityTemplate?.(
            pendingTemplateReapply.productType,
            pendingTemplateReapply.salesUnitType
          );
          setPendingTemplateReapply(null);
        }}
      />
    </form>
  );
}
