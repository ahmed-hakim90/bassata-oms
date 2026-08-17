"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
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

export async function getOrderMutationCapabilities(): Promise<{
  canRefund: boolean;
  canVoid: boolean;
}> {
  const user = await requireAuth();
  const [refundsOn, canRefundPerm, canVoidPerm] = await Promise.all([
    isFeatureEnabled("refunds"),
    permissionRepo.hasPermission("order_refund"),
    permissionRepo.hasPermission("order_void"),
  ]);
  const privileged = user.role === "owner" || user.role === "manager";
  return {
    canVoid: privileged || canVoidPerm,
    canRefund: refundsOn && (privileged || canRefundPerm),
  };
}

export async function getOrderDetailAction(orderId: string): Promise<{
  order: OrderWithDetails;
  canRefund: boolean;
  canVoid: boolean;
} | null> {
  await requireAuth();
  const [order, capabilities] = await Promise.all([
    getOrder(orderId),
    getOrderMutationCapabilities(),
  ]);
  if (!order) return null;
  return { order, ...capabilities };
}

export async function voidOrderAction(orderId: string): Promise<OrderMutationResult> {
  const user = await requirePermissionOrRole("order_void", ["owner", "manager"]);
  const result = await voidOrder(orderId, user.id);
  if (!result) throw new Error("الطلب غير موجود أو ملغي مسبقاً");
  revalidateOrderPaths(result.order.id, result.order.session_id);
  return result;
}

export async function refundOrderAction(orderId: string): Promise<OrderMutationResult> {
  await requireFeature("refunds");
  const user = await requirePermissionOrRole("order_refund", ["owner", "manager"]);
  const result = await refundOrder(orderId, user.id);
  if (!result) throw new Error("الطلب غير موجود أو لا يمكن ردّه");
  revalidateOrderPaths(result.order.id, result.order.session_id);
  return result;
}
