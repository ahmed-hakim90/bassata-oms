import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as customerAccountRepo from "@/lib/repositories/customer-account.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { getDefaultWarehouse } from "@/lib/repositories/warehouse.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type {
  MeasurementUnit,
  Order,
  OrderItem,
  OrderItemDeduction,
  OrderPayment,
} from "@/lib/types";

function convertUnit(
  qty: number,
  from: MeasurementUnit,
  to: MeasurementUnit
): number {
  if (from === to) return qty;
  if (from === "kg" && to === "gram") return qty * 1000;
  if (from === "gram" && to === "kg") return qty / 1000;
  if (from === "liter" && to === "ml") return qty * 1000;
  if (from === "ml" && to === "liter") return qty / 1000;
  return qty;
}

async function restoreOrderInventory(
  order: Order,
  items: OrderItem[],
  deductions: OrderItemDeduction[],
  userId: string,
  referenceType: "order_refund" | "order_void",
  reason: string
) {
  const warehouse = await getDefaultWarehouse(order.store_id);
  if (!warehouse) return;

  const deductionsByItem = new Map<string, OrderItemDeduction[]>();
  for (const d of deductions) {
    const list = deductionsByItem.get(d.order_item_id) ?? [];
    list.push(d);
    deductionsByItem.set(d.order_item_id, list);
  }

  for (const item of items) {
    const itemDeductions = deductionsByItem.get(item.id);
    if (itemDeductions && itemDeductions.length > 0) {
      for (const d of itemDeductions) {
        const ingredient = await catalogRepo.getProduct(d.ingredient_product_id);
        if (!ingredient?.track_inventory) continue;
        const restoreQty = convertUnit(d.quantity, d.unit, ingredient.unit);
        await adjustStock({
          storeId: order.store_id,
          warehouseId: warehouse.id,
          productId: d.ingredient_product_id,
          variantId: null,
          quantityDelta: restoreQty,
          movementType: "adjustment",
          referenceType,
          referenceId: order.id,
          reason,
          createdBy: userId,
        });
      }
      continue;
    }

    const product = await catalogRepo.getProduct(item.product_id);
    if (product?.track_inventory) {
      await adjustStock({
        storeId: order.store_id,
        warehouseId: warehouse.id,
        productId: item.product_id,
        variantId: item.variant_id,
        quantityDelta: item.quantity,
        movementType: "adjustment",
        referenceType,
        referenceId: order.id,
        reason,
        createdBy: userId,
      });
    }
  }
}

async function reverseCustomerCreditSale(
  order: Order,
  payments: OrderPayment[],
  userId: string,
  reason: "Order voided" | "Order refunded"
) {
  if (!order.customer_id || !payments.some((payment) => payment.method === "credit")) return;

  const customer = await customerRepo.getCustomer(order.customer_id);
  if (!customer) return;

  await customerAccountRepo.recordCustomerLedgerEntry({
    storeId: order.store_id,
    customerId: order.customer_id,
    entryType: "refund",
    debit: 0,
    credit: order.total,
    orderId: order.id,
    reference: order.order_number,
    notes: reason,
    createdBy: userId,
  });
  await customerRepo.updateCustomer(order.customer_id, {
    account_balance: customer.account_balance - order.total,
  });
}

export interface OrderItemWithName extends OrderItem {
  productName: string;
}

export interface OrderWithDetails extends Order {
  items: OrderItemWithName[];
  payments: OrderPayment[];
  customerName: string | null;
  storeName: string;
}

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
    storeName: store?.name ?? "Store",
  };
}

export async function voidOrder(orderId: string, userId: string): Promise<Order | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order || order.status === "voided") return null;
  await assertPeriodOpen(order.store_id, order.created_at);

  const items = await orderRepo.getOrderItems(orderId);
  const deductions = await orderRepo.getOrderDeductionsByOrderId(orderId);
  const payments = await orderRepo.getOrderPayments(orderId);
  await restoreOrderInventory(order, items, deductions, userId, "order_void", "Order voided");
  await reverseCustomerCreditSale(order, payments, userId, "Order voided");

  const updated = await orderRepo.updateOrderStatus(orderId, "voided");
  if (updated) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: order.store_id,
      userId,
      action: "order.voided",
      entityType: "order",
      entityId: orderId,
    });
  }
  return updated;
}

export async function refundOrder(orderId: string, userId: string): Promise<Order | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order || order.status !== "completed") return null;
  await assertPeriodOpen(order.store_id, order.created_at);

  const items = await orderRepo.getOrderItems(orderId);
  const deductions = await orderRepo.getOrderDeductionsByOrderId(orderId);
  const payments = await orderRepo.getOrderPayments(orderId);
  await restoreOrderInventory(order, items, deductions, userId, "order_refund", "Order refunded");
  await reverseCustomerCreditSale(order, payments, userId, "Order refunded");

  const updated = await orderRepo.updateOrderStatus(orderId, "refunded");
  if (updated) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: order.store_id,
      userId,
      action: "order.refunded",
      entityType: "order",
      entityId: orderId,
      metadata: { total: order.total },
    });
  }
  return updated;
}
