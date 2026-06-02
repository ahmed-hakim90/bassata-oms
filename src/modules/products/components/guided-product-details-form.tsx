"use client";

import { useState } from "react";
import type React from "react";
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
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import type { Category } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { getVisibleAdvancedSettingsForProduct } from "@/modules/products/lib/advanced-settings-visibility";
import type { ProductFormValues } from "@/modules/products/components/product-form-dialog";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categories: Category[];
  isEdit: boolean;
  souqnaEnabled: boolean;
  currency: string;
  activityType: BusinessActivityType;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  onCancel: () => void;
  onApplyActivityTemplate?: (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"]
  ) => void;
};

const STEP_TITLES = ["البيانات الأساسية", "نوع المنتج", "التسعير", "المخزون"] as const;
const PRODUCT_TYPE_CHOICES: Array<{
  id: ProductFormValues["product_type"];
  label: string;
  hint: string;
}> = [
  { id: "finished_product", label: "منتج بيع مباشر", hint: "منتج جاهز للبيع" },
  { id: "finished", label: "منتج وزني", hint: "يُسعّر حسب الوزن أو الكمية" },
  { id: "ingredient", label: "مكوّن", hint: "يُستخدم في تحضير الوصفات" },
  { id: "packaging_material", label: "مواد تعبئة", hint: "أكواب وملاعق وعلب وأكياس" },
  { id: "service", label: "خدمة", hint: "خدمة بدون مخزون" },
];

export function GuidedProductDetailsForm({
  form,
  categories,
  isEdit,
  souqnaEnabled,
  currency,
  activityType,
  onSubmit,
  onCancel,
  onApplyActivityTemplate,
}: Props) {
  const [step, setStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const values = form.watch();
  const [errorText, setErrorText] = useState<string | null>(null);
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
  const showPriceByAmount = visibleAdvancedSettings.has("price_by_amount");
  const showWholesale = visibleAdvancedSettings.has("wholesale");
  const showSerialNumber = visibleAdvancedSettings.has("serial_number");

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
    const fieldsByStep: Record<number, Array<keyof ProductFormValues>> = {
      1: ["name", "category_id", "sku", "barcode", "image_url"],
      2: ["product_type", "sales_unit_type"],
      3: ["base_price", "sale_price"],
      4: ["track_inventory", "expiry_tracking_enabled"],
    };
    const fields = fieldsByStep[targetStep] ?? [];
    if (fields.length === 0) return true;
    return form.trigger(fields);
  };

  const goToStep = async (target: number) => {
    if (target <= step) {
      setErrorText(null);
      setStep(target);
      return;
    }
    const isValid = await validateStep(step);
    if (!isValid) {
      setErrorText("يرجى إكمال الحقول المطلوبة قبل المتابعة.");
      return;
    }
    setErrorText(null);
    setStep(target);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 pt-2">
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 p-2 text-xs">
        {STEP_TITLES.map((title, idx) => (
          <button
            key={title}
            type="button"
            aria-current={step === idx + 1 ? "step" : undefined}
            className={`rounded-lg px-2 py-1 ${step === idx + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => {
              void goToStep(idx + 1);
            }}
          >
            {idx + 1}. {title}
          </button>
        ))}
      </div>
      {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">اسم المنتج</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>التصنيف</Label>
              <Select value={values.category_id} onValueChange={(v) => form.setValue("category_id", v ?? "", { shouldValidate: true })}>
                <SelectTrigger>
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...form.register("sku")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode">الباركود</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image_url">رابط صورة المنتج</Label>
            <Input id="image_url" value={values.image_url ?? ""} onChange={(e) => form.setValue("image_url", e.target.value || null)} placeholder="https://example.com/image.jpg" />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>نوع المنتج</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRODUCT_TYPE_CHOICES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl border p-3 text-left ${values.product_type === item.id ? "border-primary bg-primary/10" : "border-border/60"}`}
                  onClick={() => {
                    form.setValue("product_type", item.id, { shouldValidate: true });
                    onApplyActivityTemplate?.(item.id, values.sales_unit_type);
                  }}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>طريقة البيع</Label>
              <Select value={values.sales_unit_type} onValueChange={(v) => {
                const nextSales = (v ?? "piece") as ProductFormValues["sales_unit_type"];
                form.setValue("sales_unit_type", nextSales, { shouldValidate: true });
                onApplyActivityTemplate?.(values.product_type, nextSales);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { id: "piece", label: "منتج بيع مباشر" },
                    { id: "weight", label: "منتج وزني" },
                    { id: "volume", label: "مكوّن" },
                    { id: "pack", label: "مواد تعبئة" },
                  ].map((u) => (
                    <SelectItem key={u.id} value={u.id} label={u.label}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>وحدة المخزون</Label>
              <Select value={values.sale_unit} onValueChange={(v) => form.setValue("sale_unit", (v ?? "piece") as ProductFormValues["sale_unit"], { shouldValidate: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} label={u}>{formatUnit(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="base_price">سعر التكلفة</Label>
              <Input id="base_price" type="number" step="0.01" {...form.register("base_price", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sale_price">سعر البيع</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                value={values.sale_price ?? ""}
                onChange={(e) => form.setValue("sale_price", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 p-3 text-sm">
            <div className="font-medium">{values.name || "منتج بدون اسم"}</div>
            <div className="text-muted-foreground">
              النوع {values.product_type} | التكلفة {values.base_price} {currency}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.is_active} onCheckedChange={(v) => form.setValue("is_active", Boolean(v))} />
              نشط
            </label>
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
            {souqnaEnabled && (values.product_type === "finished_product" || values.product_type === "finished") ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.publish_to_souqna} onCheckedChange={(v) => form.setValue("publish_to_souqna", Boolean(v))} />
                نشر في سوقنا
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/60 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <span>إعدادات متقدمة</span>
          {advancedOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-3">
          {showInventoryTracking ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>طريقة التتبع</Label>
                <Select value={values.inventory_tracking_mode} onValueChange={(v) => form.setValue("inventory_tracking_mode", (v ?? "standard") as ProductFormValues["inventory_tracking_mode"], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {trackingModes.map((mode) => (
                      <SelectItem key={mode} value={mode} label={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>آلية تدوير المخزون</Label>
                <Select value={values.inventory_rotation_method} onValueChange={(v) => form.setValue("inventory_rotation_method", (v ?? "FIFO") as ProductFormValues["inventory_rotation_method"], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rotationMethods.map((method) => (
                      <SelectItem key={method} value={method} label={method}>{method}</SelectItem>
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
                <span className="text-sm">إعدادات الدُفعات: تتبّع تواريخ الصلاحية</span>
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
                    <Label>وحدة مدة الصلاحية</Label>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHELF_LIFE_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit} label={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>سياسة انتهاء الصلاحية</Label>
                <Select value={values.expiry_policy} onValueChange={(v) => form.setValue("expiry_policy", (v ?? "block_sale") as ProductFormValues["expiry_policy"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRY_POLICIES.map((policy) => (
                      <SelectItem key={policy} value={policy} label={policy}>{policy}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          {showFractionalQuantity ? (
            <label className="flex items-center gap-2 rounded-xl border p-2">
              <Checkbox checked={values.allow_fractional_quantity} onCheckedChange={(v) => form.setValue("allow_fractional_quantity", v === true)} />
              <span className="text-xs">تحويل الوحدات: السماح بالكمية الكسرية</span>
            </label>
          ) : null}
          {showPriceByAmount || showWholesale || showSerialNumber ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {showPriceByAmount || showSerialNumber ? (
                <label className="flex items-center gap-2 rounded-xl border p-2">
                  <Checkbox checked={values.allow_price_input} onCheckedChange={(v) => form.setValue("allow_price_input", v === true)} />
                  <span className="text-xs">
                    {showPriceByAmount && showSerialNumber
                      ? "رقم تسلسلي / سعر حسب الكمية"
                      : showPriceByAmount
                        ? "سعر حسب الكمية"
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
              <Label>نوع المنتج (متقدم)</Label>
              <Select value={values.product_type} onValueChange={(v) => {
                const nextType = (v ?? "finished_product") as ProductFormValues["product_type"];
                form.setValue("product_type", nextType, { shouldValidate: true });
                onApplyActivityTemplate?.(nextType, values.sales_unit_type);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>وحدة الأساس (متقدم)</Label>
              <Select value={values.base_unit} onValueChange={(v) => form.setValue("base_unit", (v ?? "piece") as ProductFormValues["base_unit"], { shouldValidate: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} label={u}>{formatUnit(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>
        ) : null}
      </div>

      <DialogFooter className="px-0 pb-0">
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
      </DialogFooter>
    </form>
  );
}
