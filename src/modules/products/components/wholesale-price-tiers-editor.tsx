"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MeasurementUnit, Product, ProductPriceTier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/digits";
import { formatUnit } from "@/lib/units";
import {
  deletePriceTiersAction,
  listPriceTiersAction,
  upsertPriceTiersAction,
} from "@/modules/products/actions/price-tier.actions";

interface WholesalePriceTiersEditorProps {
  product: Product;
  currency: string;
  /** When provided, skip the blocking first-load gate (prefetch / known empty). */
  initialTiers?: ProductPriceTier[];
}

function tierName(qty: number) {
  return qty <= 1 ? "جملة" : `جملة من ${qty}`;
}

function sortTiers(rows: ProductPriceTier[]) {
  return [...rows].sort((a, b) => a.min_quantity - b.min_quantity);
}

export function WholesalePriceTiersEditor({
  product,
  currency,
  initialTiers,
}: WholesalePriceTiersEditorProps) {
  const unit = (product.sale_unit ?? product.unit ?? "piece") as MeasurementUnit;
  const seeded = initialTiers !== undefined;
  const [tiers, setTiers] = useState<ProductPriceTier[]>(() =>
    sortTiers((initialTiers ?? []).filter((t) => t.sale_mode === "wholesale"))
  );
  const [loading, setLoading] = useState(!seeded);
  const [minQuantity, setMinQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const snapshotRef = useRef<ProductPriceTier[] | null>(null);
  const cancelledTempIdsRef = useRef(new Set<string>());

  // Keep UI interactive while loading. Only hydrate from prefetch once per product
  // so a late parent update doesn't wipe optimistic adds.
  const seedAppliedForProductRef = useRef<string | null>(null);

  useEffect(() => {
    if (seeded) {
      if (seedAppliedForProductRef.current !== product.id) {
        seedAppliedForProductRef.current = product.id;
        setTiers(sortTiers(initialTiers.filter((t) => t.sale_mode === "wholesale")));
      } else if (
        tiers.length === 0 &&
        initialTiers.some((t) => t.sale_mode === "wholesale")
      ) {
        // Prefetch caught up after empty shell — fill without clobbering local adds.
        setTiers(sortTiers(initialTiers.filter((t) => t.sale_mode === "wholesale")));
      }
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listPriceTiersAction(product.id)
      .then((rows) => {
        if (!cancelled) setTiers(sortTiers(rows.filter((t) => t.sale_mode === "wholesale")));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "تعذر تحميل شرائح الجملة");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tiers intentionally omitted; only hydrate empty→prefetch
  }, [product.id, seeded, initialTiers]);

  function handleAdd() {
    const qty = parseFloat(sanitizeDecimalInput(minQuantity)) || 0;
    const unitPrice = parseFloat(sanitizeDecimalInput(price)) || 0;
    if (qty <= 0) {
      toast.error("أقل كمية لازم تكون أكبر من صفر");
      return;
    }
    if (unitPrice <= 0) {
      toast.error("سعر القطعة مطلوب");
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: ProductPriceTier = {
      id: tempId,
      org_id: "",
      product_id: product.id,
      variant_id: null,
      name: tierName(qty),
      sale_mode: "wholesale",
      min_quantity: qty,
      unit,
      price: unitPrice,
      active: true,
      created_at: now,
      updated_at: now,
    };

    snapshotRef.current = tiers;
    setTiers(sortTiers([...tiers, optimistic]));
    setMinQuantity("1");
    setPrice("");

    void (async () => {
      try {
        const row = await upsertPriceTiersAction({
          product_id: product.id,
          variant_id: null,
          name: tierName(qty),
          sale_mode: "wholesale",
          min_quantity: qty,
          unit,
          price: unitPrice,
          active: true,
        });
        if (cancelledTempIdsRef.current.has(tempId)) {
          cancelledTempIdsRef.current.delete(tempId);
          try {
            await deletePriceTiersAction(row.id);
          } catch {
            /* best-effort cleanup */
          }
          return;
        }
        setTiers((prev) => {
          const withoutTemp = prev.filter((t) => t.id !== tempId);
          if (withoutTemp.some((t) => t.id === row.id)) return sortTiers(withoutTemp);
          return sortTiers([...withoutTemp, row]);
        });
      } catch (e) {
        if (snapshotRef.current) setTiers(snapshotRef.current);
        toast.error(e instanceof Error ? e.message : "تعذر حفظ الشريحة");
      }
    })();
  }

  function handleUpdate(tier: ProductPriceTier, next: { min_quantity?: number; price?: number }) {
    if (tier.id.startsWith("temp-")) return;
    const qty = next.min_quantity ?? tier.min_quantity;
    const unitPrice = next.price ?? tier.price;
    if (qty <= 0 || unitPrice <= 0) {
      toast.error("كمية أو سعر غير صالح");
      return;
    }

    snapshotRef.current = tiers;
    setTiers((prev) =>
      sortTiers(
        prev.map((t) =>
          t.id === tier.id
            ? { ...t, min_quantity: qty, price: unitPrice, name: tierName(qty) }
            : t
        )
      )
    );

    void (async () => {
      try {
        const row = await upsertPriceTiersAction({
          id: tier.id,
          product_id: product.id,
          variant_id: tier.variant_id,
          name: tierName(qty),
          sale_mode: "wholesale",
          min_quantity: qty,
          unit: tier.unit,
          price: unitPrice,
          active: tier.active,
        });
        setTiers((prev) => sortTiers(prev.map((t) => (t.id === tier.id ? row : t))));
      } catch (e) {
        if (snapshotRef.current) setTiers(snapshotRef.current);
        toast.error(e instanceof Error ? e.message : "تعذر تعديل الشريحة");
      }
    })();
  }

  function handleDelete(id: string) {
    snapshotRef.current = tiers;
    setTiers((prev) => prev.filter((t) => t.id !== id));

    if (id.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(id);
      return;
    }

    void (async () => {
      try {
        await deletePriceTiersAction(id);
      } catch (e) {
        if (snapshotRef.current) setTiers(snapshotRef.current);
        toast.error(e instanceof Error ? e.message : "تعذر حذف الشريحة");
      }
    })();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">شرائح سعر الجملة</h3>
        <p className="text-sm text-muted-foreground">
          حدّد من كام قطعة يبدأ السعر، وسعر القطعة في الشريحة دي. فاتورة الجملة هتطبق أقرب شريحة مناسبة
          للكمية.
        </p>
      </div>

      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label>من كمية ({formatUnit(unit)})</Label>
          <Input
            inputMode="decimal"
            value={minQuantity}
            onChange={(e) => setMinQuantity(sanitizeDecimalInput(e.target.value))}
            placeholder="1"
          />
        </div>
        <div className="space-y-1.5">
          <Label>سعر القطعة</Label>
          <Input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(sanitizeDecimalInput(e.target.value))}
            placeholder="0"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={handleAdd}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" />
            إضافة شريحة
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">جاري تحميل الشرائح المحفوظة…</p>
      ) : tiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لسه مفيش شرائح. ضيف شريحة واحدة على الأقل (مثلاً من 1 قطعة) عشان فاتورة الجملة تاخد السعر صح.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-start">
                <th className="px-3 py-2 font-medium">الشريحة</th>
                <th className="px-3 py-2 font-medium">من كمية</th>
                <th className="px-3 py-2 font-medium">سعر القطعة</th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{tier.name}</td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      defaultValue={String(tier.min_quantity)}
                      key={`q-${tier.id}-${tier.min_quantity}`}
                      disabled={tier.id.startsWith("temp-")}
                      onBlur={(e) => {
                        const next =
                          parseFloat(sanitizeDecimalInput(e.target.value)) || tier.min_quantity;
                        if (next !== tier.min_quantity) {
                          handleUpdate(tier, { min_quantity: next });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      defaultValue={String(tier.price)}
                      key={`p-${tier.id}-${tier.price}`}
                      disabled={tier.id.startsWith("temp-")}
                      onBlur={(e) => {
                        const next = parseFloat(sanitizeDecimalInput(e.target.value)) || tier.price;
                        if (next !== tier.price) {
                          handleUpdate(tier, { price: next });
                        }
                      }}
                    />
                    <span className="ms-2 text-xs text-muted-foreground">
                      {formatCurrency(tier.price, currency)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(tier.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
