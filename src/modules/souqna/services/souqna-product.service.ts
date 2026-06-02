import { createAdminClient } from "@/lib/supabase/admin";
import type { SouqnaAuthContext } from "@/lib/api/souqna-auth";
import {
  getDefaultWarehouseForStore,
  getProductStockQuantity,
  writeSouqnaIntegrationLog,
} from "@/lib/repositories/souqna.repository";
import type { SouqnaProductsQuery } from "@/modules/souqna/schemas/souqna-products.schema";

export interface SouqnaProductDto {
  external_product_id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category_name: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  availability: "in_stock" | "out_of_stock";
  images: string[];
  is_active: boolean;
  publish_to_souqna: boolean;
  updated_at: string;
}

export interface SouqnaProductsResponse {
  data: SouqnaProductDto[];
  pagination: {
    page: number;
    limit: number;
    has_more: boolean;
  };
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "string" ? Number(value) : value;
}

function isPublicUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function resolvePricing(basePrice: number, salePrice: number | null) {
  if (salePrice != null && salePrice < basePrice) {
    return { price: basePrice, sale_price: salePrice };
  }
  return { price: basePrice, sale_price: null };
}

export function mapSouqnaAvailability(trackInventory: boolean, stockQuantity: number) {
  return !trackInventory || stockQuantity > 0 ? "in_stock" : "out_of_stock";
}

export { resolvePricing, isPublicUrl };

export async function listSouqnaProducts(
  ctx: SouqnaAuthContext,
  query: SouqnaProductsQuery
): Promise<SouqnaProductsResponse> {
  const admin = createAdminClient();
  const offset = (query.page - 1) * query.limit;
  const fetchLimit = query.limit + 1;

  let q = admin
    .from("products")
    .select(
      "id, name, sku, barcode, description, base_price, sale_price, image_url, is_active, publish_to_souqna, track_inventory, updated_at, category_id"
    )
    .eq("org_id", ctx.orgId)
    .eq("publish_to_souqna", true)
    .eq("product_type", "finished")
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + fetchLimit - 1);

  if (query.updated_after) {
    q = q.gt("updated_at", query.updated_after);
  }

  const { data: products, error } = await q;
  if (error) throw new Error(error.message);

  const rows = products ?? [];
  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  const categoryIds = [...new Set(pageRows.map((row) => row.category_id).filter(Boolean))];
  const categoryMap = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: categories, error: categoryError } = await admin
      .from("categories")
      .select("id, name")
      .in("id", categoryIds as string[]);
    if (categoryError) throw new Error(categoryError.message);
    for (const category of categories ?? []) {
      categoryMap.set(category.id, category.name);
    }
  }

  const warehouse = await getDefaultWarehouseForStore(ctx.storeId);
  const stockByProduct = new Map<string, number>();

  if (warehouse) {
    const productIds = pageRows.map((row) => row.id);
    if (productIds.length > 0) {
      const { data: stockRows, error: stockError } = await admin
        .from("stock_levels")
        .select("product_id, quantity, reserved_quantity")
        .eq("store_id", ctx.storeId)
        .eq("warehouse_id", warehouse.id)
        .is("variant_id", null)
        .in("product_id", productIds);
      if (stockError) throw new Error(stockError.message);
      for (const stock of stockRows ?? []) {
        const available = Math.max(0, num(stock.quantity) - num(stock.reserved_quantity));
        stockByProduct.set(stock.product_id, available);
      }
    }
  }

  const data: SouqnaProductDto[] = pageRows.map((row) => {
    const stockQuantity = row.track_inventory ? (stockByProduct.get(row.id) ?? 0) : 0;
    const pricing = resolvePricing(num(row.base_price), row.sale_price != null ? num(row.sale_price) : null);
    return {
      external_product_id: row.id,
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      description: row.description ?? "",
      category_name: row.category_id ? (categoryMap.get(row.category_id) ?? "") : "",
      price: pricing.price,
      sale_price: pricing.sale_price,
      stock_quantity: stockQuantity,
      availability: mapSouqnaAvailability(row.track_inventory, stockQuantity),
      images: isPublicUrl(row.image_url) ? [row.image_url] : [],
      is_active: row.is_active,
      publish_to_souqna: row.publish_to_souqna ?? true,
      updated_at: row.updated_at,
    };
  });

  const response: SouqnaProductsResponse = {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      has_more: hasMore,
    },
  };

  await writeSouqnaIntegrationLog({
    orgId: ctx.orgId,
    storeId: ctx.storeId,
    direction: "inbound",
    endpoint: "/api/souqna/products",
    requestType: "products.list",
    requestPayload: query as unknown as Record<string, unknown>,
    responsePayload: {
      count: data.length,
      pagination: response.pagination,
    },
    status: "success",
  });

  return response;
}

export async function logSouqnaProductsError(
  ctx: SouqnaAuthContext | null,
  query: Record<string, unknown>,
  error: unknown
) {
  if (!ctx) return;
  await writeSouqnaIntegrationLog({
    orgId: ctx.orgId,
    storeId: ctx.storeId,
    direction: "inbound",
    endpoint: "/api/souqna/products",
    requestType: "products.list",
    requestPayload: query,
    status: "error",
    error: error instanceof Error ? error.message : "Unknown error",
  });
}

export { getProductStockQuantity };
