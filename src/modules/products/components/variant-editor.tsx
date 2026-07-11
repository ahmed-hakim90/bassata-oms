"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Product, ProductVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import {
  createVariantAction,
  deleteVariantAction,
  listVariantsAction,
  updateVariantAction,
} from "@/modules/products/actions/variant.actions";
import { RecipeEditor } from "./recipe-editor";

interface VariantEditorProps {
  product: Product;
  currency: string;
  recipesEnabled?: boolean;
  initialVariants?: ProductVariant[];
}

export function VariantEditor({
  product,
  currency,
  recipesEnabled = false,
  initialVariants = [],
}: VariantEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [loading, setLoading] = useState(initialVariants.length === 0);
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    sku: "",
    barcode: "",
    price: "",
    image_url: "",
    variant_kind: "standard" as ProductVariant["variant_kind"],
    quantity_value: "",
    quantity_unit: "kg" as NonNullable<ProductVariant["quantity_unit"]>,
    price_mode: "calculate_from_unit_price" as NonNullable<ProductVariant["price_mode"]>,
    fixed_price: "",
  });

  async function reload() {
    const rows = await listVariantsAction(product.id);
    setVariants(rows);
  }

  function nextVariantSku() {
    const base = product.sku || product.name.replace(/\s+/g, "-").toUpperCase();
    return `${base}-${variants.length + 1}`;
  }

  useEffect(() => {
    let cancelled = false;
    void listVariantsAction(product.id)
      .then((rows) => {
        if (!cancelled) setVariants(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "تعذر تحميل أحجام المنتج"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Seed from page data; refresh from server once per product open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialVariants is mount seed only
  }, [product.id]);

  function handleCreate() {
    const price = Number(draft.price) || 0;
    if (!draft.name.trim() || price <= 0) {
      toast.error("الاسم والسعر مطلوبان");
      return;
    }
    startTransition(async () => {
      try {
        const sku = draft.sku.trim() || nextVariantSku();
        await createVariantAction(product.id, {
          name: draft.name.trim(),
          sku,
          barcode: draft.barcode.trim() || sku,
          price_delta: 0,
          price,
          image_url: draft.image_url.trim() || null,
          is_active: true,
          variant_kind: draft.variant_kind,
          quantity_value: draft.quantity_value ? Number(draft.quantity_value) : null,
          quantity_unit: draft.quantity_unit,
          price_mode: "fixed_price",
          fixed_price: price,
        });
        setDraft({
          name: "",
          sku: "",
          barcode: "",
          price: "",
          image_url: "",
          variant_kind: "standard",
          quantity_value: "",
          quantity_unit: "kg",
          price_mode: "fixed_price",
          fixed_price: "",
        });
        await reload();
        setAddOpen(false);
        toast.success("تم إنشاء الحجم");
      } catch {
        toast.error("تعذر إنشاء الحجم");
      }
    });
  }

  function handleUpdate(id: string, patch: Partial<ProductVariant>) {
    startTransition(async () => {
      try {
        await updateVariantAction(id, patch);
        await reload();
      } catch {
        toast.error("تعذر تحديث الحجم");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteVariantAction(id);
        await reload();
        toast.success("تم حذف الحجم");
      } catch {
        toast.error("تعذر حذف الحجم");
      }
    });
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading variants…</p>;
  }

  return (
    <div className="grid gap-4 pt-2">
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">الأحجام والأسعار</p>
            <p className="text-xs text-muted-foreground">أضف حجمًا بسعر وباركود في صف واحد.</p>
          </div>
          <Button
            type="button"
            variant={addOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAddOpen((current) => !current)}
          >
            <Plus className="size-4" />
            {addOpen ? "إغلاق" : "إضافة حجم"}
          </Button>
        </div>

        {addOpen ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_120px_120px_150px_auto] sm:items-end">
          <div className="grid gap-1">
            <Label className="text-xs">الاسم</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="صغير"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">SKU</Label>
            <Input
              value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
              placeholder={nextVariantSku()}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">باركود</Label>
            <Input
              value={draft.barcode}
              onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">السعر ({currency})</Label>
            <Input
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">النوع</Label>
            <select
              className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
              value={draft.variant_kind}
              onChange={(e) =>
                setDraft((d) => ({ ...d, variant_kind: e.target.value as ProductVariant["variant_kind"] }))
              }
            >
              <option value="standard">standard</option>
              <option value="weight_portion">weight_portion</option>
            </select>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={pending}>
            <Plus className="size-4" /> حفظ
          </Button>
          {draft.variant_kind === "weight_portion" ? (
            <div className="grid gap-2 sm:col-span-full sm:grid-cols-4">
              <div className="grid gap-1">
                <Label className="text-xs">الكمية</Label>
                <Input
                  value={draft.quantity_value}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity_value: e.target.value }))}
                  placeholder="0.250"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">الوحدة</Label>
                <select
                  className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                  value={draft.quantity_unit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quantity_unit: e.target.value as NonNullable<ProductVariant["quantity_unit"]>,
                    }))
                  }
                >
                  <option value="kg">kg</option>
                  <option value="gram">gram</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">طريقة السعر</Label>
                <select
                  className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                  value={draft.price_mode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      price_mode: e.target.value as NonNullable<ProductVariant["price_mode"]>,
                    }))
                  }
                >
                  <option value="calculate_from_unit_price">calculate_from_unit_price</option>
                  <option value="fixed_price">fixed_price</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">سعر ثابت ({currency})</Label>
                <Input
                  value={draft.fixed_price}
                  onChange={(e) => setDraft((d) => ({ ...d, fixed_price: e.target.value }))}
                  placeholder="50"
                />
              </div>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No variants yet. Products with variants require size selection at POS.
        </p>
      ) : (
        <Tabs defaultValue={variants[0]?.id}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {variants.map((v) => (
              <TabsTrigger key={v.id} value={v.id} className="text-xs">
                {v.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {variants.map((variant) => (
            <TabsContent key={variant.id} value={variant.id} className="grid gap-4 pt-3">
              <div className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_120px_1fr_1fr_auto_auto] sm:items-end">
                <div className="grid gap-1">
                  <Label className="text-xs">الاسم</Label>
                  <Input
                    defaultValue={variant.name}
                    onBlur={(e) => {
                      if (e.target.value !== variant.name) {
                        handleUpdate(variant.id, { name: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">السعر</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={variant.price ?? ""}
                    onBlur={(e) => {
                      const price = e.target.value ? Number(e.target.value) : null;
                      if (price !== variant.price) {
                        handleUpdate(variant.id, {
                          price,
                          fixed_price: price,
                          price_mode: price != null ? "fixed_price" : variant.price_mode,
                        });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">SKU</Label>
                  <Input
                    defaultValue={variant.sku}
                    onBlur={(e) => {
                      if (e.target.value !== variant.sku) {
                        handleUpdate(variant.id, { sku: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">باركود</Label>
                  <Input
                    defaultValue={variant.barcode}
                    onBlur={(e) => {
                      if (e.target.value !== variant.barcode) {
                        handleUpdate(variant.id, { barcode: e.target.value });
                      }
                    }}
                  />
                </div>
                <label className="flex h-8 items-center gap-2 text-sm">
                  <Checkbox
                    checked={variant.is_active}
                    onCheckedChange={(v) => handleUpdate(variant.id, { is_active: Boolean(v) })}
                  />
                  نشط
                </label>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(variant.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" /> حذف
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                سعر البيع: {formatCurrency(variant.price ?? product.base_price + variant.price_delta, currency)}
              </p>
              {recipesEnabled ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-medium">Recipe for {variant.name}</p>
                  <RecipeEditor
                    product={product}
                    currency={currency}
                    variantId={variant.id}
                    variantLabel={variant.name}
                    salePrice={variant.price ?? product.base_price + variant.price_delta}
                  />
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
