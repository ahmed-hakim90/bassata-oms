import { createAdminClient } from "@/lib/supabase/admin";
import type { SouqnaIntegrationLog, SouqnaIntegrationStats } from "@/lib/types";
import type { SouqnaIntegrationLogRow } from "@/lib/supabase/database.types";

function mapLog(row: SouqnaIntegrationLogRow): SouqnaIntegrationLog {
  return {
    id: row.id,
    org_id: row.org_id,
    store_id: row.store_id,
    direction: (row.direction ?? "inbound") as SouqnaIntegrationLog["direction"],
    endpoint: row.endpoint ?? "",
    request_type: row.request_type,
    request_payload: (row.request_payload ?? null) as Record<string, unknown> | null,
    response_payload: (row.response_payload ?? null) as Record<string, unknown> | null,
    status: row.status,
    error: row.error,
    error_message: row.error,
    created_at: row.created_at,
  };
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "string" ? Number(value) : value;
}

export async function writeSouqnaIntegrationLog(input: {
  orgId: string;
  storeId?: string | null;
  direction?: "inbound" | "outbound";
  endpoint?: string;
  requestType: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  status: "success" | "error" | "rejected";
  error?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("souqna_integration_logs").insert({
    org_id: input.orgId,
    store_id: input.storeId ?? null,
    direction: input.direction ?? "inbound",
    endpoint: input.endpoint ?? "",
    request_type: input.requestType,
    request_payload: (input.requestPayload ?? null) as import("@/lib/supabase/database.types").Json,
    response_payload: (input.responsePayload ?? null) as import("@/lib/supabase/database.types").Json,
    status: input.status,
    error: input.error ?? null,
  });
  if (error) {
    console.error("[souqna-log]", error.message);
  }
}

function isMissingSouqnaSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("souqna_integration_logs") ||
    message.includes("schema cache")
  );
}

export async function listSouqnaIntegrationLogs(input: {
  orgId: string;
  limit?: number;
  offset?: number;
}): Promise<SouqnaIntegrationLog[]> {
  const admin = createAdminClient();
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const { data, error } = await admin
    .from("souqna_integration_logs")
    .select("*")
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    if (isMissingSouqnaSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(mapLog);
}

export async function getSouqnaIntegrationStats(orgId: string): Promise<SouqnaIntegrationStats> {
  const admin = createAdminClient();

  const [{ count: publishedProducts }, { count: importedOrders }] = await Promise.all([
    admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("publish_to_souqna", true)
      .eq("product_type", "finished"),
    admin
      .from("online_orders")
      .select("*", { count: "exact", head: true })
      .eq("source", "souqna"),
  ]);

  const { data: logs } = await admin
    .from("souqna_integration_logs")
    .select("request_type, status, error, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = logs ?? [];
  const lastProducts = rows.find((row) => row.request_type === "products.list" && row.status === "success");
  const lastOrder = rows.find((row) => row.request_type === "orders.create" && row.status === "success");
  const lastError = rows.find((row) => row.status === "error" || row.status === "rejected");

  return {
    published_products_count: publishedProducts ?? 0,
    imported_orders_count: importedOrders ?? 0,
    last_products_sync_at: lastProducts?.created_at ?? null,
    last_order_import_at: lastOrder?.created_at ?? null,
    last_error_at: lastError?.created_at ?? null,
    last_error_message: lastError?.error ?? null,
  };
}

export async function souqnaSchemaReady(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("souqna_integration_logs").select("id").limit(1);
  return !isMissingSouqnaSchema(error);
}

export async function findSouqnaOrderByExternalId(externalOrderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("online_orders")
    .select("id, store_id, status")
    .eq("source", "souqna")
    .eq("external_order_id", externalOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDefaultWarehouseForStore(storeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("warehouses")
    .select("id")
    .eq("store_id", storeId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getProductAvailableStock(input: {
  storeId: string;
  warehouseId: string;
  productId: string;
}): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stock_levels")
    .select("quantity, reserved_quantity")
    .eq("store_id", input.storeId)
    .eq("warehouse_id", input.warehouseId)
    .eq("product_id", input.productId)
    .is("variant_id", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const onHand = num(data?.quantity);
  const reserved = num(data?.reserved_quantity);
  return Math.max(0, onHand - reserved);
}

/** @deprecated use getProductAvailableStock */
export async function getProductStockQuantity(input: {
  storeId: string;
  warehouseId: string;
  productId: string;
}): Promise<number> {
  return getProductAvailableStock(input);
}

export async function reserveProductStock(input: {
  storeId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  referenceId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: level, error: levelError } = await admin
    .from("stock_levels")
    .select("id, quantity, reserved_quantity")
    .eq("store_id", input.storeId)
    .eq("warehouse_id", input.warehouseId)
    .eq("product_id", input.productId)
    .is("variant_id", null)
    .maybeSingle();
  if (levelError) throw new Error(levelError.message);

  const onHand = num(level?.quantity);
  const reserved = num(level?.reserved_quantity);
  const available = onHand - reserved;
  if (available < input.quantity) {
    throw new Error("Product out of stock");
  }

  const newReserved = reserved + input.quantity;
  if (level) {
    const { error } = await admin
      .from("stock_levels")
      .update({ reserved_quantity: newReserved, updated_at: new Date().toISOString() })
      .eq("id", level.id);
    if (error) throw new Error(error.message);
  }

  const { error: movementError } = await admin.from("inventory_movements").insert({
    store_id: input.storeId,
    warehouse_id: input.warehouseId,
    product_id: input.productId,
    variant_id: null,
    movement_type: "reservation",
    quantity_delta: 0,
    reference_type: "online_order",
    reference_id: input.referenceId,
    reason: `Souqna reservation +${input.quantity}`,
    created_by: input.storeId,
  });
  if (movementError) throw new Error(movementError.message);
}

export async function releaseSouqnaOrderReservations(input: {
  storeId: string;
  warehouseId: string;
  onlineOrderId: string;
  items: { productId: string; quantity: number }[];
}): Promise<void> {
  const admin = createAdminClient();

  for (const item of input.items) {
    const { data: level, error: levelError } = await admin
      .from("stock_levels")
      .select("id, reserved_quantity")
      .eq("store_id", input.storeId)
      .eq("warehouse_id", input.warehouseId)
      .eq("product_id", item.productId)
      .is("variant_id", null)
      .maybeSingle();
    if (levelError) throw new Error(levelError.message);
    if (!level) continue;

    const reserved = num(level.reserved_quantity);
    const releaseQty = Math.min(reserved, item.quantity);
    if (releaseQty <= 0) continue;

    const { error } = await admin
      .from("stock_levels")
      .update({
        reserved_quantity: Math.max(0, reserved - releaseQty),
        updated_at: new Date().toISOString(),
      })
      .eq("id", level.id);
    if (error) throw new Error(error.message);

    await admin.from("inventory_movements").insert({
      store_id: input.storeId,
      warehouse_id: input.warehouseId,
      product_id: item.productId,
      variant_id: null,
      movement_type: "reservation_release",
      quantity_delta: 0,
      reference_type: "online_order",
      reference_id: input.onlineOrderId,
      reason: `Souqna reservation release -${releaseQty}`,
      created_by: input.storeId,
    });
  }
}

export async function countPendingSouqnaOrders(storeId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("online_orders")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("source", "souqna")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listRecentSouqnaOrders(storeId: string, limit = 5) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("online_orders")
    .select("id, customer_name, customer_phone, total, status, created_at, fulfillment_type")
    .eq("store_id", storeId)
    .eq("source", "souqna")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
