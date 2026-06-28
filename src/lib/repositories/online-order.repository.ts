import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapOnlineOrder, mapOnlineOrderItem } from "@/lib/repositories/mappers";
import type { OnlineOrder, OnlineOrderItem } from "@/lib/types";

export async function listOnlineOrders(storeId?: string): Promise<OnlineOrder[]> {
  const db = await getDb();
  let q = db.from("online_orders").select("*").order("created_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listOnlineOrders");
  return (data ?? []).map(mapOnlineOrder);
}

export async function getOnlineOrder(id: string): Promise<OnlineOrder | null> {
  const db = await getDb();
  const { data, error } = await db.from("online_orders").select("*").eq("id", id).maybeSingle();
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
  const { data, error } = await db
    .from("online_orders")
    .update(input)
    .eq("id", id)
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
