import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapCategory, mapProduct, mapVariant } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { getDefaultWarehouse } from "@/lib/repositories/warehouse.repository";
import type { Category, Product, ProductVariant } from "@/lib/types";

export async function listProducts(options?: {
  categoryId?: string;
  activeOnly?: boolean;
  search?: string;
  productType?: Product["product_type"];
}): Promise<Product[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db.from("products").select("*").eq("org_id", orgId);
  if (options?.categoryId) q = q.eq("category_id", options.categoryId);
  if (options?.activeOnly) q = q.eq("is_active", true);
  if (options?.productType) q = q.eq("product_type", options.productType);
  const { data, error } = await q;
  if (error) throwDbError(error, "listProducts");
  let result = (data ?? []).map(mapProduct);
  if (options?.search?.trim()) {
    const s = options.search.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.barcode.includes(s)
    );
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getProduct");
  return data ? mapProduct(data) : null;
}

export async function createProduct(
  input: Omit<Product, "id" | "org_id" | "updated_at">,
  storeIds: string[]
): Promise<Product> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("products")
    .insert({ org_id: orgId, ...input })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createProduct");
  if (input.track_inventory) {
    for (const storeId of storeIds) {
      const warehouse = await getDefaultWarehouse(storeId);
      if (!warehouse) continue;
      await db.from("stock_levels").insert({
        store_id: storeId,
        warehouse_id: warehouse.id,
        product_id: data.id,
        variant_id: null,
        quantity: 0,
        reorder_point: 10,
      });
    }
  }
  return mapProduct(data);
}

export async function updateProduct(
  id: string,
  input: Partial<Omit<Product, "id" | "org_id" | "updated_at">>
): Promise<Product | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("products")
    .update(input)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateProduct");
  return data ? mapProduct(data) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { error } = await db.from("products").delete().eq("id", id).eq("org_id", orgId);
  if (error) throwDbError(error, "deleteProduct");
  return true;
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("categories")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order");
  if (error) throwDbError(error, "listCategories");
  return (data ?? []).map(mapCategory);
}

export async function createCategory(input: Omit<Category, "id" | "org_id">): Promise<Category> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("categories")
    .insert({ org_id: orgId, ...input })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createCategory");
  return mapCategory(data);
}

export async function updateCategory(
  id: string,
  input: Partial<Omit<Category, "id" | "org_id">>
): Promise<Category | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("categories")
    .update(input)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateCategory");
  return data ? mapCategory(data) : null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("org_id", orgId);
  if (count && count > 0) return false;
  const { error } = await db.from("categories").delete().eq("id", id).eq("org_id", orgId);
  if (error) throwDbError(error, "deleteCategory");
  return true;
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_variants")
    .select("*, products!inner(org_id)")
    .eq("product_id", productId)
    .eq("products.org_id", orgId);
  if (error) throwDbError(error, "listVariants");
  return (data ?? []).map(mapVariant).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listVariantsForProducts(
  productIds: string[]
): Promise<Map<string, ProductVariant[]>> {
  const map = new Map<string, ProductVariant[]>();
  if (productIds.length === 0) return map;
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_variants")
    .select("*, products!inner(org_id)")
    .in("product_id", productIds)
    .eq("products.org_id", orgId);
  if (error) throwDbError(error, "listVariantsForProducts");
  for (const row of data ?? []) {
    const variant = mapVariant(row);
    const list = map.get(variant.product_id) ?? [];
    list.push(variant);
    map.set(variant.product_id, list);
  }
  for (const [productId, variants] of map) {
    map.set(
      productId,
      variants.sort((a, b) => a.name.localeCompare(b.name))
    );
  }
  return map;
}

export async function getVariant(id: string): Promise<ProductVariant | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("product_variants")
    .select("*, products!inner(org_id)")
    .eq("id", id)
    .eq("products.org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getVariant");
  return data ? mapVariant(data) : null;
}

export function buildVariantInsertPayload(
  productId: string,
  input: Omit<ProductVariant, "id" | "product_id">
) {
  return {
    product_id: productId,
    name: input.name,
    sku: input.sku,
    barcode: input.barcode,
    price_delta: input.price_delta,
    price: input.price,
    image_url: input.image_url,
    is_active: input.is_active,
    variant_kind: input.variant_kind,
    quantity_value: input.quantity_value,
    quantity_unit: input.quantity_unit,
    price_mode: input.price_mode,
    fixed_price: input.fixed_price,
  };
}

export async function createVariant(
  productId: string,
  input: Omit<ProductVariant, "id" | "product_id">,
  storeIds: string[]
): Promise<ProductVariant> {
  const db = await getDb();
  const { data, error } = await db
    .from("product_variants")
    .insert(buildVariantInsertPayload(productId, input))
    .select()
    .single();
  if (error || !data) throwDbError(error, "createVariant");

  const product = await getProduct(productId);
  if (product?.track_inventory) {
    for (const storeId of storeIds) {
      const warehouse = await getDefaultWarehouse(storeId);
      if (!warehouse) continue;
      await db.from("stock_levels").insert({
        store_id: storeId,
        warehouse_id: warehouse.id,
        product_id: productId,
        variant_id: data.id,
        quantity: 0,
        reorder_point: 10,
      });
    }
  }

  return mapVariant(data);
}

export async function updateVariant(
  id: string,
  input: Partial<Omit<ProductVariant, "id" | "product_id">>
): Promise<ProductVariant | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data: existing, error: existingError } = await db
    .from("product_variants")
    .select("id, product_id, products!inner(org_id)")
    .eq("id", id)
    .eq("products.org_id", orgId)
    .maybeSingle();
  if (existingError) throwDbError(existingError, "updateVariant.scope");
  if (!existing) return null;
  const { data, error } = await db
    .from("product_variants")
    .update(input)
    .eq("id", id)
    .eq("product_id", existing.product_id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateVariant");
  return data ? mapVariant(data) : null;
}

export async function deleteVariant(id: string): Promise<boolean> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data: existing, error: existingError } = await db
    .from("product_variants")
    .select("id, product_id, products!inner(org_id)")
    .eq("id", id)
    .eq("products.org_id", orgId)
    .maybeSingle();
  if (existingError) throwDbError(existingError, "deleteVariant.scope");
  if (!existing) return true;
  const { error } = await db
    .from("product_variants")
    .delete()
    .eq("id", id)
    .eq("product_id", existing.product_id);
  if (error) throwDbError(error, "deleteVariant");
  return true;
}
