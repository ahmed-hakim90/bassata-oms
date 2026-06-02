"use server";

import { revalidatePath } from "next/cache";
import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import {
  createInvoiceFromOnlineOrder,
  markOrderPaid,
  updateOnlineOrderStatus,
} from "@/modules/online-orders/services/online-order.service";
import type { FeatureFlag } from "@/lib/constants";
import type { OnlineOrderStatus, PaymentMethod } from "@/lib/types";

export async function updateOnlineOrderStatusAction(
  onlineOrderId: string,
  status: OnlineOrderStatus
) {
  const user = await requirePermissionOrRole("online_order_manage", ["owner", "manager", "cashier"]);
  await updateOnlineOrderStatus(onlineOrderId, status, user.id);
  revalidatePath("/orders/online");
}

export async function createOnlineOrderInvoiceAction(onlineOrderId: string) {
  const user = await requirePermissionOrRole("online_order_manage", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  await requireFeature("inventory_deduction");

  const session = await getActiveSessionForPos(ctx);
  if (!session) throw new Error("Active cashier session required");

  const result = await createInvoiceFromOnlineOrder({
    onlineOrderId,
    storeId: ctx.storeId,
    sessionId: session.id,
    cashierId: ctx.activeCashierId,
    userId: user.id,
  });
  revalidatePath("/orders/online");
  revalidatePath("/orders");
  revalidatePath(`/orders/${result.order_id}`);
  return result;
}

export async function markOrderPaidAction(orderId: string, paymentMethod: PaymentMethod = "cash") {
  const user = await requirePermissionOrRole("online_order_manage", ["owner", "manager", "cashier"]);
  const storeId = await getValidatedActiveStoreId();
  await requireFeature(`payment_${paymentMethod}` as FeatureFlag);

  const result = await markOrderPaid({
    orderId,
    storeId,
    paymentMethod,
    userId: user.id,
  });
  revalidatePath("/orders/online");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return result;
}
