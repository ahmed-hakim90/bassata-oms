"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess, getActiveSessionForPos } from "@/lib/auth/pos-access";
import {
  invoiceOnlineOrder,
  updateOnlineOrderDetails,
  updateOnlineOrderStatus,
  getOnlineOrderWithItems,
} from "@/modules/online-orders/services/online-order.service";
import type {
  StaffOnlineOrderInput,
} from "@/modules/online-orders/services/online-order.service";
import type { OnlineOrderStatus, PaymentSplit } from "@/lib/types";
import { getOrder } from "@/modules/orders/services/order.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { buildReceiptPayloadFromOrder } from "@/modules/pos/utils/receipt-payload";

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

export async function invoiceOnlineOrderAction(
  orderId: string,
  payments: PaymentSplit[]
) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  const session = await getActiveSessionForPos(ctx);
  if (!session) throw new Error("Active cashier session required");
  if (!payments.length) throw new Error("Payment required");

  const result = await invoiceOnlineOrder({
    onlineOrderId: orderId,
    sessionId: session.id,
    cashierId: ctx.activeCashierId,
    storeId: ctx.storeId,
    userId: user.id,
    deviceId: ctx.deviceId,
    payments,
  });

  revalidatePath("/online-orders");
  revalidatePath("/pos");
  revalidatePath(`/online-orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${result.order_id}`);
  return result;
}

export async function getOnlineOrderReceiptPayloadAction(onlineOrderId: string) {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const onlineOrder = await getOnlineOrderWithItems(onlineOrderId);
  if (!onlineOrder?.order_id) throw new Error("Receipt not available yet");
  const order = await getOrder(onlineOrder.order_id);
  if (!order) throw new Error("Order not found");
  const branding = await getReportBranding(order.store_id);
  return buildReceiptPayloadFromOrder(order, branding);
}
