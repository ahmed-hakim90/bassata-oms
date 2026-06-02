"use client";

import { useState } from "react";
import type React from "react";
import type { UseFormReturn } from "react-hook-form";
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
import { EXPIRY_POLICIES, INVENTORY_ROTATION_METHODS, INVENTORY_TRACKING_MODES, MEASUREMENT_UNITS, PRODUCT_TYPES } from "@/lib/constants";
import { formatUnit } from "@/lib/units";
import { selectLabelById } from "@/lib/select-label";
import type { Category } from "@/lib/types";
import type { ProductFormValues } from "./product-form-dialog";
import { DialogFooter } from "@/components/ui/dialog";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categories: Category[];
  isEdit: boolean;
  souqnaEnabled: boolean;
  currency: string;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  onCancel: () => void;
  onApplyActivityTemplate?: (
    productType: ProductFormValues["product_type"],
    salesUnitType?: ProductFormValues["sales_unit_type"]
  ) => void;
};

const STEP_TITLES = ["Basic Information", "Selling Method", "Pricing", "Review"] as const;

export function GuidedProductDetailsForm({
  form,
  categories,
  isEdit,
  souqnaEnabled,
  currency,
  onSubmit,
  onCancel,
  onApplyActivityTemplate,
}: Props) {
  const [step, setStep] = useState(1);
  const values = form.watch();
  const isService = values.product_type === "service";
  const isWeight = values.sales_unit_type === "weight";
  const isPiece = values.sales_unit_type === "piece";

  return (
    <form onSubmit={onSubmit} className="grid gap-4 pt-2">
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 p-2 text-xs">
        {STEP_TITLES.map((title, idx) => (
          <button
            key={title}
            type="button"
            className={`rounded-lg px-2 py-1 ${step === idx + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => setStep(idx + 1)}
          >
            {idx + 1}. {title}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={values.category_id} onValueChange={(v) => form.setValue("category_id", v ?? "", { shouldValidate: true })}>
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
              <Label>Product Type</Label>
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
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...form.register("sku")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image_url">Product Image URL</Label>
            <Input id="image_url" value={values.image_url ?? ""} onChange={(e) => form.setValue("image_url", e.target.value || null)} placeholder="https://..." />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>How do you sell this item?</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "piece", label: "By Piece", examples: "Water bottle" },
                { id: "weight", label: "By Weight", examples: "Cheese, meat, rice" },
                { id: "volume", label: "By Volume", examples: "Juice" },
                { id: "pack", label: "By Pack", examples: "Carton, box" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl border p-3 text-left ${values.sales_unit_type === item.id ? "border-primary bg-primary/10" : "border-border/60"}`}
                  onClick={() => {
                    const nextSales = item.id as ProductFormValues["sales_unit_type"];
                    form.setValue("sales_unit_type", nextSales, { shouldValidate: true });
                    onApplyActivityTemplate?.(values.product_type, nextSales);
                  }}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.examples}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Base Unit</Label>
              <Select value={values.base_unit} onValueChange={(v) => form.setValue("base_unit", (v ?? "piece") as ProductFormValues["base_unit"], { shouldValidate: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((u) => (
                    <SelectItem key={u} value={u} label={u}>{formatUnit(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Weight/Sale Unit</Label>
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
          {!isService && isWeight ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked />
                Sell by Weight
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.allow_price_input} onCheckedChange={(v) => form.setValue("allow_price_input", v === true)} />
                Allow Price Input
              </label>
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Fixed Weight Variants</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {["1/8 KG", "1/4 KG", "1/2 KG", "1 KG"].map((v) => (
                    <span key={v} className="rounded-lg border px-2 py-1">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {!isService && !isPiece ? (
            <label className="flex items-center gap-2 rounded-xl border p-3">
              <Checkbox checked={values.allow_fractional_quantity} onCheckedChange={(v) => form.setValue("allow_fractional_quantity", v === true)} />
              <span className="text-sm">Allow fractional quantity</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="base_price">Cost Price</Label>
              <Input id="base_price" type="number" step="0.01" {...form.register("base_price", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sale_price">Sale Price</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                value={values.sale_price ?? ""}
                onChange={(e) => form.setValue("sale_price", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
          <details className="rounded-xl border border-border/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">Advanced Pricing</summary>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 rounded-xl border p-3">
                <Checkbox checked={values.wholesale_enabled} onCheckedChange={(v) => form.setValue("wholesale_enabled", v === true)} />
                <span className="text-sm">Wholesale Pricing</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Price tiers and customer groups remain available through advanced modules.
              </p>
            </div>
          </details>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 p-3 text-sm">
            <div className="font-medium">{values.name || "Unnamed product"}</div>
            <div className="text-muted-foreground">
              Selling by {values.sales_unit_type} | Cost {values.base_price} {currency}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...form.register("description")} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.is_active} onCheckedChange={(v) => form.setValue("is_active", Boolean(v))} />
              Active
            </label>
            {!isService ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.track_inventory} onCheckedChange={(v) => form.setValue("track_inventory", Boolean(v))} />
                Track inventory
              </label>
            ) : null}
            {souqnaEnabled && (values.product_type === "finished_product" || values.product_type === "finished") ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values.publish_to_souqna} onCheckedChange={(v) => form.setValue("publish_to_souqna", Boolean(v))} />
                Publish to Souqna
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <details className="rounded-xl border border-border/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Advanced Inventory Settings</summary>
        <div className="mt-3 space-y-3">
          {!isService ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tracking Mode</Label>
                <Select value={values.inventory_tracking_mode} onValueChange={(v) => form.setValue("inventory_tracking_mode", (v ?? "standard") as ProductFormValues["inventory_tracking_mode"], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_TRACKING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode} label={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Rotation Method</Label>
                <Select value={values.inventory_rotation_method} onValueChange={(v) => form.setValue("inventory_rotation_method", (v ?? "FIFO") as ProductFormValues["inventory_rotation_method"], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_ROTATION_METHODS.map((method) => (
                      <SelectItem key={method} value={method} label={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          {!isService ? (
            <>
              <label className="flex items-center gap-2 rounded-xl border p-3">
                <Checkbox checked={values.expiry_tracking_enabled} onCheckedChange={(v) => form.setValue("expiry_tracking_enabled", v === true)} />
                <span className="text-sm">Track Expiry Dates</span>
              </label>
              {values.expiry_tracking_enabled ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>Shelf Life Days</Label>
                    <Input type="number" min={0} {...form.register("shelf_life_days", { valueAsNumber: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shelf Life Months</Label>
                    <Input type="number" min={0} {...form.register("shelf_life_months", { valueAsNumber: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shelf Life Years</Label>
                    <Input type="number" min={0} {...form.register("shelf_life_years", { valueAsNumber: true })} />
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label>Expiry Policy</Label>
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
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-xl border p-2">
              <Checkbox checked={values.allow_price_input} onCheckedChange={(v) => form.setValue("allow_price_input", v === true)} />
              <span className="text-xs">Price Input</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border p-2">
              <Checkbox checked={values.wholesale_enabled} onCheckedChange={(v) => form.setValue("wholesale_enabled", v === true)} />
              <span className="text-xs">Wholesale</span>
            </label>
          </div>
        </div>
      </details>

      <DialogFooter className="px-0 pb-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
          Back
        </Button>
        <Button type="button" variant="outline" disabled={step === 4} onClick={() => setStep((current) => Math.min(4, current + 1))}>
          Next
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {isEdit ? "Save changes" : "Create product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
