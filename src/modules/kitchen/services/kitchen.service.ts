import { requirePermission, requireStoreAccess } from "@/lib/auth/guards";
import { isFoodServiceActivity } from "@/lib/business-activity-flags";
import { createClient } from "@/lib/supabase/server";
import { getActiveStoreId } from "@/lib/auth/session";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";

export type KitchenStatus = "queued" | "preparing" | "ready" | "served";

const KITCHEN_STATUS_FORWARD: Record<KitchenStatus, KitchenStatus | null> = {
  queued: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
};

export function isAllowedKitchenTransition(current: KitchenStatus, next: KitchenStatus): boolean {
  return KITCHEN_STATUS_FORWARD[current] === next;
}

export type KitchenTicket = {
  id: string;
  orderNumber: string;
  kitchenStatus: KitchenStatus;
  createdAt: string;
  total: number;
  items: { name: string; quantity: number; modifiers: string[] }[];
};

async function requireKitchenDisplayEnabled(): Promise<void> {
  const activity = await getBusinessActivitySettings();
  if (!isFoodServiceActivity(activity.activity_type)) {
    throw new Error(
      "شاشة المطبخ للمطاعم والكافيهات والأنشطة اللي فيها تحضير — مش متاحة لنوع النشاط الحالي."
    );
  }
}

export async function listKitchenTickets(storeId?: string): Promise<KitchenTicket[]> {
  await requirePermission("order_view");
  await requireKitchenDisplayEnabled();
  const supabase = await createClient();
  const resolvedStoreId = storeId ?? (await getActiveStoreId());
  if (!resolvedStoreId) return [];
  await requireStoreAccess(resolvedStoreId);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, kitchen_status, created_at, total")
    .eq("store_id", resolvedStoreId)
    .eq("status", "completed")
    .in("kitchen_status", ["queued", "preparing", "ready"])
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw new Error(error.message);
  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, product_id, quantity, modifiers, products(name)")
    .in("order_id", orderIds);
  if (itemsError) throw new Error(itemsError.message);

  const itemsByOrder = new Map<string, KitchenTicket["items"]>();
  for (const row of items ?? []) {
    const mods = Array.isArray(row.modifiers)
      ? (row.modifiers as { name?: string }[]).map((m) => m.name ?? "").filter(Boolean)
      : [];
    const productRel = row.products as { name?: string } | { name?: string }[] | null;
    const productName = Array.isArray(productRel)
      ? productRel[0]?.name
      : productRel?.name;
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({
      name: productName ?? "منتج",
      quantity: Number(row.quantity),
      modifiers: mods,
    });
    itemsByOrder.set(row.order_id, list);
  }

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    kitchenStatus: (o.kitchen_status ?? "queued") as KitchenStatus,
    createdAt: o.created_at,
    total: Number(o.total),
    items: itemsByOrder.get(o.id) ?? [],
  }));
}

export async function advanceKitchenStatus(
  orderId: string,
  next: KitchenStatus
): Promise<void> {
  await requirePermission("kitchen_manage");
  await requireKitchenDisplayEnabled();
  const supabase = await createClient();
  const { data: order, error: loadError } = await supabase
    .from("orders")
    .select("id, store_id, kitchen_status")
    .eq("id", orderId)
    .maybeSingle();
  if (loadError || !order) throw new Error(loadError?.message ?? "الطلب غير موجود");
  await requireStoreAccess(order.store_id);

  const current = (order.kitchen_status ?? "queued") as KitchenStatus;
  if (!isAllowedKitchenTransition(current, next)) {
    throw new Error("انتقال حالة المطبخ غير مسموح");
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ kitchen_status: next })
    .eq("id", orderId)
    .filter("kitchen_status", order.kitchen_status == null ? "is" : "eq", order.kitchen_status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("تغيرت حالة الطلب من جهاز آخر؛ حدّث الشاشة وحاول مجددًا");
}

/** Mark completed POS order for kitchen queue when food-service activity. */
export async function enqueueKitchenIfNeeded(orderId: string, enabled: boolean): Promise<void> {
  if (!enabled) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ kitchen_status: "queued" })
    .eq("id", orderId)
    .is("kitchen_status", null);
  if (error) {
    console.warn("[kitchen] enqueue failed", error.message);
  }
}
