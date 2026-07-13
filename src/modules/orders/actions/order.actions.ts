"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  getOrder,
  refundOrder,
  voidOrder,
  type OrderMutationResult,
  type OrderWithDetails,
} from "@/modules/orders/services/order.service";

function revalidateOrderPaths(orderId: string, sessionId?: string | null) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/sessions");
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
}

export async function getOrderDetailAction(
  orderId: string
): Promise<OrderWithDetails | null> {
  await requireAuth();
  return getOrder(orderId);
}

export async function voidOrderAction(orderId: string): Promise<OrderMutationResult> {
  const user = await requirePermissionOrRole("order_void", ["owner", "manager"]);
  const result = await voidOrder(orderId, user.id);
  if (!result) throw new Error("Order not found or already voided");
  revalidateOrderPaths(result.order.id, result.order.session_id);
  return result;
}

export async function refundOrderAction(orderId: string): Promise<OrderMutationResult> {
  await requireFeature("refunds");
  const user = await requirePermissionOrRole("order_refund", ["owner", "manager"]);
  const result = await refundOrder(orderId, user.id);
  if (!result) throw new Error("Order not found or cannot be refunded");
  revalidateOrderPaths(result.order.id, result.order.session_id);
  return result;
}
