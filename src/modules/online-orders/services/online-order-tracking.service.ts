import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOnlineOrderTrackingToken } from "@/modules/online-orders/lib/online-order-tracking";
import { fulfillmentTypeLabelAr } from "@/modules/online-menu/lib/online-fulfillment";
import type { OnlineOrderStatus } from "@/lib/types";

export type PublicTrackedOnlineOrder = {
  id: string;
  storeName: string;
  status: OnlineOrderStatus;
  statusLabelAr: string;
  customerName: string;
  fulfillmentType: "pickup" | "delivery" | null;
  fulfillmentLabelAr: string;
  deliveryArea: string;
  deliveryAddress: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: { name: string; quantity: number; lineTotal: number }[];
};

const STATUS_LABELS_AR: Record<OnlineOrderStatus, string> = {
  pending: "قيد المراجعة",
  accepted: "تم القبول",
  preparing: "قيد التحضير",
  ready: "جاهز",
  cancelled: "ملغي",
  invoiced: "مكتمل",
};

/**
 * Public status-only resolver. Requires HMAC tracking token.
 * Cross-tenant safe: admin lookup by id only after token verifies.
 */
export async function getPublicOnlineOrderByTrackingToken(
  token: string
): Promise<PublicTrackedOnlineOrder | null> {
  const orderId = verifyOnlineOrderTrackingToken(token);
  if (!orderId) return null;

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("online_orders")
    .select(
      "id, store_id, customer_name, status, subtotal, total, delivery_fee, delivery_area, delivery_address, fulfillment_type, created_at, updated_at"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const [{ data: store }, { data: items }] = await Promise.all([
    admin.from("stores").select("id, name, org_id").eq("id", order.store_id).maybeSingle(),
    admin
      .from("online_order_items")
      .select("product_name, variant_name, quantity, line_total")
      .eq("online_order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);
  if (!store) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", store.org_id)
    .maybeSingle();

  const fulfillmentType =
    order.fulfillment_type === "pickup" || order.fulfillment_type === "delivery"
      ? order.fulfillment_type
      : null;

  const mappedItems = (items ?? []).map((item) => ({
    name: item.variant_name ? `${item.product_name} (${item.variant_name})` : item.product_name,
    quantity: item.quantity,
    lineTotal: Number(item.line_total),
  }));

  return {
    id: order.id,
    storeName: store.name,
    status: order.status as OnlineOrderStatus,
    statusLabelAr: STATUS_LABELS_AR[order.status as OnlineOrderStatus] ?? order.status,
    customerName: order.customer_name,
    fulfillmentType,
    fulfillmentLabelAr: fulfillmentTypeLabelAr(fulfillmentType),
    deliveryArea: order.delivery_area ?? "",
    deliveryAddress: order.delivery_address ?? "",
    deliveryFee: Number(order.delivery_fee ?? 0),
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    currency: org?.currency ?? "EGP",
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    itemCount: mappedItems.reduce((sum, item) => sum + item.quantity, 0),
    items: mappedItems,
  };
}
