import * as orderRepo from "@/lib/repositories/order.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { Order, OrderItem, OrderPayment } from "@/lib/types";

export interface OrderItemWithName extends OrderItem {
  productName: string;
}

export interface OrderWithDetails extends Order {
  items: OrderItemWithName[];
  payments: OrderPayment[];
  customerName: string | null;
  customerPhone: string | null;
  storeName: string;
}

export type OrderReverseRestock = {
  restocked: boolean;
  restockMovementCount: number;
  restockQuantityTotal: number;
  creditReversed: number;
};

export type OrderMutationResult = {
  order: Order;
  restock: OrderReverseRestock;
};

export async function listOrders(storeId?: string): Promise<Order[]> {
  return orderRepo.listOrders(storeId);
}

export async function getOrder(orderId: string): Promise<OrderWithDetails | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order) return null;

  const [store, customer, items, payments, products] = await Promise.all([
    storeRepo.getStore(order.store_id),
    order.customer_id ? customerRepo.getCustomer(order.customer_id) : null,
    orderRepo.getOrderItems(orderId),
    orderRepo.getOrderPayments(orderId),
    catalogRepo.listProducts(),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return {
    ...order,
    items: items.map((item) => ({
      ...item,
      productName: productMap.get(item.product_id) ?? "Unknown",
    })),
    payments,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    storeName: store?.name ?? "Store",
  };
}

function mapRestock(result: {
  restock: {
    restocked: boolean;
    restock_movement_count: number;
    restock_quantity_total: number;
    credit_reversed: number;
  };
}): OrderReverseRestock {
  return {
    restocked: result.restock.restocked,
    restockMovementCount: result.restock.restock_movement_count,
    restockQuantityTotal: result.restock.restock_quantity_total,
    creditReversed: result.restock.credit_reversed,
  };
}

export async function voidOrder(
  orderId: string,
  userId: string
): Promise<OrderMutationResult | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order || order.status === "voided") return null;
  await assertPeriodOpen(order.store_id, order.created_at);

  try {
    const result = await orderRepo.voidOrderRpc({ orderId, actorId: userId });
    const updated = await orderRepo.getOrder(orderId);
    if (!updated) return null;
    return { order: updated, restock: mapRestock(result) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Order already voided")) return null;
    if (message.includes("Order not found")) return null;
    if (message.includes("Cannot void a refunded order")) {
      throw new Error("لا يمكن إلغاء طلب تم ردّه");
    }
    if (message.includes("Permission denied")) {
      throw new Error("مفيش صلاحية لإلغاء الطلب");
    }
    if (message.includes("Order stock already reversed")) {
      throw new Error("تم إرجاع مخزون هذا الطلب مسبقاً");
    }
    throw error;
  }
}

export async function refundOrder(
  orderId: string,
  userId: string
): Promise<OrderMutationResult | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order || order.status !== "completed") return null;
  await assertPeriodOpen(order.store_id, order.created_at);

  try {
    const result = await orderRepo.refundOrderRpc({ orderId, actorId: userId });
    const updated = await orderRepo.getOrder(orderId);
    if (!updated) return null;
    return { order: updated, restock: mapRestock(result) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Only completed orders can be refunded")) return null;
    if (message.includes("Order not found")) return null;
    if (message.includes("Feature disabled: refunds")) {
      throw new Error("المرتجعات غير مفعلة");
    }
    if (message.includes("Permission denied")) {
      throw new Error("مفيش صلاحية لرد الطلب");
    }
    if (message.includes("Order stock already reversed")) {
      throw new Error("تم إرجاع مخزون هذا الطلب مسبقاً");
    }
    if (message.includes("Could not restore batch stock")) {
      throw new Error("تعذر إرجاع دفعات المخزون للمرتجع");
    }
    throw error;
  }
}
