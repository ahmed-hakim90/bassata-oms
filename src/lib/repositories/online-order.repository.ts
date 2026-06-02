import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapOnlineOrder, mapOnlineOrderItem } from "@/lib/repositories/mappers";
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from "@/lib/types";

export async function listOnlineOrders(storeId: string): Promise<OnlineOrder[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("online_orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listOnlineOrders");
  return (data ?? []).map(mapOnlineOrder);
}

export async function getOnlineOrder(id: string): Promise<OnlineOrder | null> {
  const db = await getDb();
  const { data, error } = await db.from("online_orders").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getOnlineOrder");
  return data ? mapOnlineOrder(data) : null;
}

export async function getOnlineOrderItems(onlineOrderId: string): Promise<OnlineOrderItem[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("online_order_items")
    .select("*")
    .eq("online_order_id", onlineOrderId);
  if (error) throwDbError(error, "getOnlineOrderItems");
  return (data ?? []).map(mapOnlineOrderItem);
}

export async function updateOnlineOrderStatus(
  id: string,
  status: OnlineOrderStatus
): Promise<OnlineOrder | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("online_orders")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateOnlineOrderStatus");
  return data ? mapOnlineOrder(data) : null;
}

export async function attachInvoice(input: {
  onlineOrderId: string;
  orderId: string;
}): Promise<OnlineOrder | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("online_orders")
    .update({ order_id: input.orderId, status: "invoiced" })
    .eq("id", input.onlineOrderId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "attachInvoice");
  return data ? mapOnlineOrder(data) : null;
}
