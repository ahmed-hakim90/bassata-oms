import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { convertUnit } from "@/lib/units";
import type { MeasurementUnit, ProductPriceTier, SalesMode } from "@/lib/types";

export async function listPriceTiers(productId: string): Promise<ProductPriceTier[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_price_tiers")
    .select("*")
    .eq("org_id", orgId)
    .eq("product_id", productId)
    .order("min_quantity", { ascending: true });
  if (error) throwDbError(error, "listPriceTiers");
  return (data ?? []) as ProductPriceTier[];
}

export async function upsertPriceTier(
  input: Omit<ProductPriceTier, "id" | "org_id" | "created_at" | "updated_at"> & { id?: string }
): Promise<ProductPriceTier> {
  const db = await getDb();
  const orgId = await getOrgId();
  const payload = { ...input, org_id: orgId };
  if (input.id) {
    const { data, error } = await db
      .from("product_price_tiers")
      .update(payload)
      .eq("id", input.id)
      .eq("org_id", orgId)
      .select("*")
      .single();
    if (error) throwDbError(error, "updatePriceTier");
    return data as ProductPriceTier;
  }
  const { data, error } = await db
    .from("product_price_tiers")
    .insert(payload)
    .select("*")
    .single();
  if (error) throwDbError(error, "createPriceTier");
  return data as ProductPriceTier;
}

export async function deletePriceTier(id: string): Promise<void> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { error } = await db.from("product_price_tiers").delete().eq("id", id).eq("org_id", orgId);
  if (error) throwDbError(error, "deletePriceTier");
}

export function resolveUnitPrice(params: {
  basePrice: number;
  quantity: number;
  saleUnit: MeasurementUnit;
  saleMode: SalesMode;
  autoApplyWholesale: boolean;
  tiers: ProductPriceTier[];
}) {
  const { basePrice, quantity, saleUnit, saleMode, autoApplyWholesale, tiers } = params;
  const byMode = tiers.filter((t) => t.active && t.sale_mode === saleMode);
  let candidates = byMode;
  if (saleMode === "retail" && autoApplyWholesale) {
    candidates = tiers.filter((t) => t.active);
  }
  const eligible = candidates
    .filter((t) => convertUnit(quantity, saleUnit, t.unit) >= t.min_quantity)
    .sort((a, b) => b.min_quantity - a.min_quantity);
  const tier = eligible[0];
  if (!tier) return { unitPrice: basePrice, tierId: null as string | null, wholesaleApplied: false };
  return {
    unitPrice: tier.price,
    tierId: tier.id,
    wholesaleApplied: tier.sale_mode === "wholesale",
  };
}
