import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { ProductPriceTier } from "@/lib/types";

export { resolveUnitPrice } from "@/modules/products/lib/resolve-unit-price";

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

/** Wholesale tiers for many products — sales invoice live pricing. */
export async function listWholesalePriceTiersByProductIds(
  productIds: string[]
): Promise<Map<string, ProductPriceTier[]>> {
  const map = new Map<string, ProductPriceTier[]>();
  if (productIds.length === 0) return map;
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_price_tiers")
    .select("*")
    .eq("org_id", orgId)
    .eq("sale_mode", "wholesale")
    .eq("active", true)
    .in("product_id", productIds)
    .order("min_quantity", { ascending: true });
  if (error) throwDbError(error, "listWholesalePriceTiersByProductIds");
  for (const row of (data ?? []) as ProductPriceTier[]) {
    const list = map.get(row.product_id) ?? [];
    list.push(row);
    map.set(row.product_id, list);
  }
  return map;
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

