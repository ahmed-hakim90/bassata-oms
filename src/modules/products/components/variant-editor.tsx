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
}

export function VariantEditor({
  product,
  currency,
  recipesEnabled = false,
}: VariantEditorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
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

  useEffect(() => {
    let cancelled = false;
    void listVariantsAction(product.id)
      .then((rows) => {
        if (!cancelled) setVariants(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  function handleCreate() {
    if (!draft.name.trim() || !draft.sku.trim()) {
      toast.error("Name and SKU are required");
      return;
    }
    startTransition(async () => {
      try {
        await createVariantAction(product.id, {
          name: draft.name.trim(),
          sku: draft.sku.trim(),
          barcode: draft.barcode.trim(),
          price_delta: 0,
          price: draft.price ? Number(draft.price) : null,
          image_url: draft.image_url.trim() || null,
          is_active: true,
          variant_kind: draft.variant_kind,
          quantity_value: draft.quantity_value ? Number(draft.quantity_value) : null,
          quantity_unit: draft.quantity_unit,
          price_mode: draft.price_mode,
          fixed_price: draft.fixed_price ? Number(draft.fixed_price) : null,
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
          price_mode: "calculate_from_unit_price",
          fixed_price: "",
        });
        await reload();
        toast.success("Variant created");
      } catch {
        toast.error("Could not create variant");
      }
    });
  }

  function handleUpdate(id: string, patch: Partial<ProductVariant>) {
    startTransition(async () => {
      try {
        await updateVariantAction(id, patch);
        await reload();
      } catch {
        toast.error("Could not update variant");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteVariantAction(id);
        await reload();
        toast.success("Variant deleted");
      } catch {
        toast.error("Could not delete variant");
      }
    });
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading variants…</p>;
  }

  return (
    <div className="grid gap-4 pt-2">
      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">Add variant</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Small"
            />
          </div>
          <div className="grid gap-1">
            <Label>SKU</Label>
            <Input
              value={draft.sku}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label>Barcode</Label>
            <Input
              value={draft.barcode}
              onChange={(e) => setDraft((d) => ({ ...d, barcode: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label>Price ({currency})</Label>
            <Input
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label>Image URL (optional)</Label>
            <Input
              value={draft.image_url}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label>Variant kind</Label>
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
          {draft.variant_kind === "weight_portion" ? (
            <>
              <div className="grid gap-1">
                <Label>Quantity value</Label>
                <Input
                  value={draft.quantity_value}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity_value: e.target.value }))}
                  placeholder="0.250"
                />
              </div>
              <div className="grid gap-1">
                <Label>Quantity unit</Label>
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
                <Label>Price mode</Label>
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
                <Label>Fixed price ({currency})</Label>
                <Input
                  value={draft.fixed_price}
                  onChange={(e) => setDraft((d) => ({ ...d, fixed_price: e.target.value }))}
                  placeholder="50"
                />
              </div>
            </>
          ) : null}
        </div>
        <Button className="mt-3" size="sm" onClick={handleCreate} disabled={pending}>
          <Plus className="size-4" /> Add variant
        </Button>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Name</Label>
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
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={variant.price ?? ""}
                    onBlur={(e) => {
                      const price = e.target.value ? Number(e.target.value) : null;
                      if (price !== variant.price) handleUpdate(variant.id, { price });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label>SKU</Label>
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
                  <Label>Barcode</Label>
                  <Input
                    defaultValue={variant.barcode}
                    onBlur={(e) => {
                      if (e.target.value !== variant.barcode) {
                        handleUpdate(variant.id, { barcode: e.target.value });
                      }
                    }}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={variant.is_active}
                  onCheckedChange={(v) => handleUpdate(variant.id, { is_active: Boolean(v) })}
                />
                Active
              </label>
              <p className="text-xs text-muted-foreground">
                Sell price: {formatCurrency(variant.price ?? product.base_price + variant.price_delta, currency)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(variant.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
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
