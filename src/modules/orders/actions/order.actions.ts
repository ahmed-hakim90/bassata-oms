"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import { refundOrder, voidOrder } from "@/modules/orders/services/order.service";

export async function voidOrderAction(orderId: string) {
  const user = await requirePermissionOrRole("order_void", ["owner", "manager"]);
  const order = await voidOrder(orderId, user.id);
  if (!order) throw new Error("Order not found or already voided");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return order;
}

export async function refundOrderAction(orderId: string) {
  await requireFeature("refunds");
  const user = await requirePermissionOrRole("order_refund", ["owner", "manager"]);
  const order = await refundOrder(orderId, user.id);
  if (!order) throw new Error("Order not found or cannot be refunded");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/sessions");
  return order;
}
