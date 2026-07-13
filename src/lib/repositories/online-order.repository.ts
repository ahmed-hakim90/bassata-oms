import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapOnlineOrder, mapOnlineOrderItem } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from "@/lib/types";

export interface OnlineOrderListFilters {
  storeId?: string;
  statuses?: OnlineOrderStatus[];
  limit?: number;
}

/** Accepts storeId string (legacy) or filter object. */
export async function listOnlineOrders(
  storeIdOrFilters?: string | OnlineOrderListFilters
): Promise<OnlineOrder[]> {
  const filters: OnlineOrderListFilters =
    typeof storeIdOrFilters === "string" || storeIdOrFilters === undefined
      ? { storeId: storeIdOrFilters }
      : storeIdOrFilters;

  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return [];
  if (filters.storeId && !storeIds.includes(filters.storeId)) return [];

  const db = await getDb();
  let q = db
    .from("online_orders")
    .select("*")
    .in("store_id", storeIds)
    .order("created_at", { ascending: false });
  if (filters.storeId) {
    q = q.eq("store_id", filters.storeId);
  }
  if (filters.statuses && filters.statuses.length > 0) {
    q = q.in("status", filters.statuses);
  }
  if (filters.limit != null) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throwDbError(error, "listOnlineOrders");
  return (data ?? []).map(mapOnlineOrder);
}

export async function getOnlineOrder(id: string): Promise<OnlineOrder | null> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return null;
  const { data, error } = await db
    .from("online_orders")
    .select("*")
    .eq("id", id)
    .in("store_id", storeIds)
    .maybeSingle();
  if (error) throwDbError(error, "getOnlineOrder");
  return data ? mapOnlineOrder(data) : null;
}

export async function getOnlineOrderItems(orderId: string): Promise<OnlineOrderItem[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("online_order_items")
    .select("*")
    .eq("online_order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throwDbError(error, "getOnlineOrderItems");
  return (data ?? []).map(mapOnlineOrderItem);
}

export async function listOnlineOrderItemsForOrders(
  orderIds: string[]
): Promise<Map<string, OnlineOrderItem[]>> {
  const map = new Map<string, OnlineOrderItem[]>();
  if (orderIds.length === 0) return map;
  for (const id of orderIds) map.set(id, []);
  const db = await getDb();
  const { data, error } = await db
    .from("online_order_items")
    .select("*")
    .in("online_order_id", orderIds)
    .order("created_at", { ascending: true });
  if (error) throwDbError(error, "listOnlineOrderItemsForOrders");
  for (const row of data ?? []) {
    const item = mapOnlineOrderItem(row);
    const list = map.get(item.online_order_id) ?? [];
    list.push(item);
    map.set(item.online_order_id, list);
  }
  return map;
}

export async function updateOnlineOrder(
  id: string,
  input: Partial<
    Pick<
      OnlineOrder,
      | "customer_name"
      | "customer_phone"
      | "notes"
      | "status"
      | "subtotal"
      | "discount"
      | "tax"
      | "total"
      | "order_id"
    >
  >
): Promise<OnlineOrder | null> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return null;
  const { data, error } = await db
    .from("online_orders")
    .update(input)
    .eq("id", id)
    .in("store_id", storeIds)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateOnlineOrder");
  return data ? mapOnlineOrder(data) : null;
}

export async function replaceOnlineOrderItems(
  orderId: string,
  items: {
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[]
): Promise<OnlineOrderItem[]> {
  const db = await getDb();
  const { error: deleteError } = await db
    .from("online_order_items")
    .delete()
    .eq("online_order_id", orderId);
  if (deleteError) throwDbError(deleteError, "replaceOnlineOrderItems.delete");

  const { data, error } = await db
    .from("online_order_items")
    .insert(items.map((item) => ({ online_order_id: orderId, ...item })))
    .select();
  if (error) throwDbError(error, "replaceOnlineOrderItems.insert");
  return (data ?? []).map(mapOnlineOrderItem);
}
