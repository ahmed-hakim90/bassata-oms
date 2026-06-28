"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import {
  invoiceOnlineOrder,
  updateOnlineOrderDetails,
  updateOnlineOrderStatus,
} from "@/modules/online-orders/services/online-order.service";
import type {
  StaffOnlineOrderInput,
} from "@/modules/online-orders/services/online-order.service";
import type { OnlineOrderStatus } from "@/lib/types";

export async function updateOnlineOrderDetailsAction(
  orderId: string,
  input: StaffOnlineOrderInput
) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const order = await updateOnlineOrderDetails(orderId, input, user.id);
  revalidatePath("/online-orders");
  revalidatePath("/pos");
  revalidatePath(`/online-orders/${orderId}`);
  return order;
}

export async function updateOnlineOrderStatusAction(
  orderId: string,
  status: Exclude<OnlineOrderStatus, "invoiced">
) {
  const user =
    status === "cancelled"
      ? await requirePermissionOrRole("order_void", ["owner", "manager"])
      : await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const order = await updateOnlineOrderStatus(orderId, status, user.id);
  revalidatePath("/online-orders");
  revalidatePath("/pos");
  revalidatePath(`/online-orders/${orderId}`);
  return order;
}

export async function invoiceOnlineOrderAction(orderId: string) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  const session = await getActiveSessionForPos(ctx);
  if (!session) throw new Error("Active cashier session required");

  const result = await invoiceOnlineOrder({
    onlineOrderId: orderId,
    sessionId: session.id,
    cashierId: ctx.activeCashierId,
    storeId: ctx.storeId,
    userId: user.id,
  });

  revalidatePath("/online-orders");
  revalidatePath("/pos");
  revalidatePath(`/online-orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${result.order_id}`);
  return result;
}
