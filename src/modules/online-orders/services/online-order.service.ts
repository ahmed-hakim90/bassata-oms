import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as onlineOrderRepo from "@/lib/repositories/online-order.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus, PaymentMethod } from "@/lib/types";
import { notifySouqnaOrderStatusChange } from "@/modules/souqna/services/souqna-webhook.service";
import { releaseSouqnaOnlineOrderStock } from "@/modules/souqna/services/souqna-order.service";

export interface OnlineOrderItemWithName extends OnlineOrderItem {
  productName: string;
  variantName: string | null;
}

export interface OnlineOrderWithDetails extends OnlineOrder {
  items: OnlineOrderItemWithName[];
  storeName: string;
}

export async function listOnlineOrders(storeId: string): Promise<OnlineOrderWithDetails[]> {
  const [orders, store, products] = await Promise.all([
    onlineOrderRepo.listOnlineOrders(storeId),
    storeRepo.getStore(storeId),
    catalogRepo.listProducts(),
  ]);
  const productMap = new Map(products.map((product) => [product.id, product.name]));
  const variantRows = await Promise.all(
    products.map(async (product) => ({
      productId: product.id,
      variants: await catalogRepo.listVariants(product.id),
    }))
  );
  const variantMap = new Map<string, string>();
  for (const row of variantRows) {
    for (const variant of row.variants) {
      variantMap.set(variant.id, variant.name);
    }
  }

  return Promise.all(
    orders.map(async (order) => {
      const items = await onlineOrderRepo.getOnlineOrderItems(order.id);
      return {
        ...order,
        storeName: store?.name ?? "Store",
        items: items.map((item) => ({
          ...item,
          productName: productMap.get(item.product_id) ?? "Unknown",
          variantName: item.variant_id ? variantMap.get(item.variant_id) ?? "Option" : null,
        })),
      };
    })
  );
}

export async function updateOnlineOrderStatus(
  id: string,
  status: OnlineOrderStatus,
  userId: string
): Promise<OnlineOrder | null> {
  const current = await onlineOrderRepo.getOnlineOrder(id);
  if (!current || current.status === "invoiced" || current.status === "cancelled") {
    return null;
  }
  const updated = await onlineOrderRepo.updateOnlineOrderStatus(id, status);
  if (updated) {
    const orgId = await getOrgId();
    if (status === "cancelled" && updated.source === "souqna") {
      await releaseSouqnaOnlineOrderStock(updated.id);
    }
    await writeAuditLog({
      orgId,
      storeId: updated.store_id,
      userId,
      action: `online_order.${status}`,
      entityType: "online_order",
      entityId: updated.id,
    });
    if (updated.source === "souqna") {
      await notifySouqnaOrderStatusChange({ order: updated, orgId, status });
    }
  }
  return updated;
}

export async function createInvoiceFromOnlineOrder(input: {
  onlineOrderId: string;
  storeId: string;
  sessionId: string;
  cashierId: string;
  userId: string;
}) {
  const onlineOrder = await onlineOrderRepo.getOnlineOrder(input.onlineOrderId);
  if (!onlineOrder) throw new Error("Online order not found");
  if (onlineOrder.store_id !== input.storeId) throw new Error("Store access denied");
  if (onlineOrder.status === "cancelled") throw new Error("Cancelled orders cannot be invoiced");
  if (onlineOrder.order_id || onlineOrder.status === "invoiced") {
    throw new Error("Online order already invoiced");
  }

  const items = await onlineOrderRepo.getOnlineOrderItems(input.onlineOrderId);
  if (items.length === 0) throw new Error("Online order has no items");

  if (onlineOrder.source === "souqna") {
    await releaseSouqnaOnlineOrderStock(input.onlineOrderId);
  }

  const result = await orderRepo.completeUnpaidCheckoutRpc({
    storeId: input.storeId,
    sessionId: input.sessionId,
    cashierId: input.cashierId,
    customerId: onlineOrder.customer_id,
    discount: onlineOrder.discount,
    lines: items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
    })),
  });

  await onlineOrderRepo.attachInvoice({
    onlineOrderId: input.onlineOrderId,
    orderId: result.order_id,
  });

  const orgId = await getOrgId();
  const invoiced = await onlineOrderRepo.getOnlineOrder(input.onlineOrderId);
  if (invoiced?.source === "souqna") {
    await notifySouqnaOrderStatusChange({
      order: invoiced,
      orgId,
      status: "invoiced",
    });
  }

  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.userId,
    action: "online_order.invoiced",
    entityType: "online_order",
    entityId: input.onlineOrderId,
    metadata: { order_id: result.order_id, order_number: result.order_number },
  });

  return result;
}

export async function markOrderPaid(input: {
  orderId: string;
  storeId: string;
  paymentMethod: PaymentMethod;
  userId: string;
}) {
  const order = await orderRepo.getOrder(input.orderId);
  if (!order) throw new Error("Order not found");
  if (order.store_id !== input.storeId) throw new Error("Store access denied");
  if (order.payment_status === "paid") return order;

  await orderRepo.addOrderPayment({
    orderId: order.id,
    method: input.paymentMethod,
    amount: order.total,
  });
  const updated = await orderRepo.updateOrderPaymentStatus(order.id, "paid");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.userId,
    action: "order.marked_paid",
    entityType: "order",
    entityId: order.id,
    metadata: { payment_method: input.paymentMethod, amount: order.total },
  });

  return updated ?? order;
}
