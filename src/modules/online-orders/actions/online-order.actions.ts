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
import type { FeatureFlag } from "@/lib/constants";
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
  if (!session) throw new Error("جلسة كاشير نشطة مطلوبة");
  if (!payments.length) throw new Error("الدفع مطلوب");

  const normalized = payments
    .map((payment) => ({
      method: payment.method,
      amount: Math.round((Number(payment.amount) || 0) * 100) / 100,
    }))
    .filter((payment) => payment.amount > 0);
  if (!normalized.length) throw new Error("أدخل مبلغ دفع صالحاً");

  const usesCredit = normalized.some((payment) => payment.method === "credit");
  const { requireFeature } = await import("@/lib/auth/guards");
  for (const payment of normalized) {
    if (payment.method === "credit") {
      await requireFeature("credit_sales");
    } else {
      await requireFeature(`payment_${payment.method}` as FeatureFlag);
    }
  }
  if (usesCredit) {
    await requirePermissionOrRole("customer_credit_sale", ["owner", "manager", "cashier"]);
  }

  const result = await invoiceOnlineOrder({
    onlineOrderId: orderId,
    sessionId: session.id,
    cashierId: ctx.activeCashierId,
    storeId: ctx.storeId,
    userId: user.id,
    deviceId: ctx.deviceId,
    payments: normalized,
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
  if (!onlineOrder?.order_id) throw new Error("الإيصال غير متاح بعد");
  const order = await getOrder(onlineOrder.order_id);
  if (!order) throw new Error("الطلب غير موجود");
  const branding = await getReportBranding(order.store_id);
  return buildReceiptPayloadFromOrder(order, branding);
}
