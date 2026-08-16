import { orderBusinessAt } from "@/lib/document-date";
import { getDb } from "@/lib/repositories/client";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import {
  aggregateCashierPerformance,
  type CashierPerformanceRow,
} from "@/modules/reports/services/executive-analytics.service";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import type { Order, OrderPayment, PaymentMethod } from "@/lib/types";

export interface SalesEntityDayRow {
  date: string;
  revenue: number;
  orders: number;
  quantity?: number;
}

export interface SalesEntityProductRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface ProductSalesMiniReport {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  avgLineRevenue: number;
  revenueByDay: SalesEntityDayRow[];
  byStore: { storeId: string; storeName: string; quantity: number; revenue: number; orders: number }[];
  byCashier: { cashierId: string; cashierName: string; quantity: number; revenue: number; orders: number }[];
}

export interface BranchSalesMiniReport {
  storeId: string;
  storeName: string;
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueByDay: SalesEntityDayRow[];
  topProducts: SalesEntityProductRow[];
  cashiers: CashierPerformanceRow[];
  paymentMix: { method: PaymentMethod; amount: number }[];
}

export interface CashierSalesMiniReport {
  cashierId: string;
  cashierName: string;
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  sessionCount: number;
  closedSessionCount: number;
  totalVariance: number;
  revenueByDay: SalesEntityDayRow[];
  topProducts: SalesEntityProductRow[];
}

function completedPaidInRange(orders: Order[], from: Date, to: Date): Order[] {
  return orders.filter(
    (o) =>
      o.status === "completed" &&
      o.payment_status !== "unpaid" &&
      new Date(orderBusinessAt(o)) >= from &&
      new Date(orderBusinessAt(o)) <= to
  );
}

function netLineRevenue(
  item: { order_id: string; line_total: number | string | null },
  revenueFactors: Map<string, number>
): number {
  const gross = Number(item.line_total ?? 0);
  const factor = revenueFactors.get(item.order_id);
  if (!factor || factor <= 0) return gross;
  return gross * factor;
}

async function loadOrderItems(orderIds: string[]) {
  if (orderIds.length === 0) return [];
  const db = await getDb();
  const { data } = await db.from("order_items").select("*").in("order_id", orderIds);
  return data ?? [];
}

async function loadOrderPayments(orderIds: string[]): Promise<OrderPayment[]> {
  if (orderIds.length === 0) return [];
  return orderRepo.getOrderPaymentsForOrders(orderIds);
}

export async function getProductSalesMiniReport(options: {
  productId: string;
  storeId?: string;
  from: Date;
  to: Date;
}): Promise<ProductSalesMiniReport | null> {
  const product = (await catalogRepo.listProducts()).find((p) => p.id === options.productId);
  if (!product) return null;

  const [orders, stores, sessions, users] = await Promise.all([
    orderRepo.listOrders(options.storeId),
    storeRepo.listStores(),
    sessionRepo.listSessions(options.storeId),
    userRepo.listUsers(),
  ]);
  const inRange = completedPaidInRange(orders, options.from, options.to);
  const items = await loadOrderItems(inRange.map((o) => o.id));
  const productItems = items.filter((i) => i.product_id === options.productId);
  if (productItems.length === 0) {
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? "",
      totalQuantity: 0,
      totalRevenue: 0,
      orderCount: 0,
      avgLineRevenue: 0,
      revenueByDay: [],
      byStore: [],
      byCashier: [],
    };
  }

  const orderById = new Map(inRange.map((o) => [o.id, o]));
  const revenueFactors = new Map(
    inRange.map((o) => [o.id, o.subtotal > 0 ? o.total / o.subtotal : 0])
  );
  const sessionCashier = new Map(sessions.map((s) => [s.id, s.cashier_id]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  const orderIdsWithProduct = new Set(productItems.map((i) => i.order_id));
  let totalQuantity = 0;
  let totalRevenue = 0;
  const dayMap = new Map<string, { revenue: number; orders: Set<string>; quantity: number }>();
  const storeMap = new Map<
    string,
    { quantity: number; revenue: number; orders: Set<string> }
  >();
  const cashierMap = new Map<
    string,
    { quantity: number; revenue: number; orders: Set<string> }
  >();

  for (const item of productItems) {
    const order = orderById.get(item.order_id);
    if (!order) continue;
    const qty = Number(item.quantity ?? 0);
    const revenue = netLineRevenue(item, revenueFactors);
    totalQuantity += qty;
    totalRevenue += revenue;

    const day = orderBusinessAt(order).slice(0, 10);
    const dayAcc = dayMap.get(day) ?? {
      revenue: 0,
      orders: new Set<string>(),
      quantity: 0,
    };
    dayAcc.revenue += revenue;
    dayAcc.quantity += qty;
    dayAcc.orders.add(order.id);
    dayMap.set(day, dayAcc);

    const storeAcc = storeMap.get(order.store_id) ?? {
      quantity: 0,
      revenue: 0,
      orders: new Set<string>(),
    };
    storeAcc.quantity += qty;
    storeAcc.revenue += revenue;
    storeAcc.orders.add(order.id);
    storeMap.set(order.store_id, storeAcc);

    const cashierId =
      (order.session_id && sessionCashier.get(order.session_id)) || order.created_by;
    if (cashierId) {
      const cashierAcc = cashierMap.get(cashierId) ?? {
        quantity: 0,
        revenue: 0,
        orders: new Set<string>(),
      };
      cashierAcc.quantity += qty;
      cashierAcc.revenue += revenue;
      cashierAcc.orders.add(order.id);
      cashierMap.set(cashierId, cashierAcc);
    }
  }

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku ?? "",
    totalQuantity,
    totalRevenue,
    orderCount: orderIdsWithProduct.size,
    avgLineRevenue:
      orderIdsWithProduct.size > 0 ? totalRevenue / orderIdsWithProduct.size : 0,
    revenueByDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        revenue: d.revenue,
        orders: d.orders.size,
        quantity: d.quantity,
      })),
    byStore: [...storeMap.entries()]
      .map(([storeId, d]) => ({
        storeId,
        storeName: storeName.get(storeId) ?? "—",
        quantity: d.quantity,
        revenue: d.revenue,
        orders: d.orders.size,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    byCashier: [...cashierMap.entries()]
      .map(([cashierId, d]) => ({
        cashierId,
        cashierName: userName.get(cashierId) ?? "—",
        quantity: d.quantity,
        revenue: d.revenue,
        orders: d.orders.size,
      }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export async function getBranchSalesMiniReport(options: {
  storeId: string;
  from: Date;
  to: Date;
  fromIso?: string;
  toIso?: string;
  days: number;
}): Promise<BranchSalesMiniReport | null> {
  const store = await storeRepo.getStore(options.storeId);
  if (!store) return null;

  const [sales, cashiers, orders] = await Promise.all([
    getSalesReport({
      storeId: options.storeId,
      days: options.days,
      from: options.fromIso,
      to: options.toIso,
    }),
    aggregateCashierPerformance(
      await sessionRepo.listSessions(options.storeId),
      await orderRepo.listOrders(options.storeId),
      new Map((await userRepo.listUsers()).map((u) => [u.id, u.name])),
      options.from,
      options.to
    ),
    orderRepo.listOrders(options.storeId),
  ]);

  const inRange = completedPaidInRange(orders, options.from, options.to);
  const payments = await loadOrderPayments(inRange.map((o) => o.id));
  const paymentMixMap = new Map<PaymentMethod, number>();
  for (const p of payments) {
    paymentMixMap.set(p.method, (paymentMixMap.get(p.method) ?? 0) + p.amount);
  }

  return {
    storeId: store.id,
    storeName: store.name,
    totalRevenue: sales.totalRevenue,
    orderCount: sales.orderCount,
    avgOrderValue: sales.avgOrderValue,
    revenueByDay: sales.revenueByDay.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      orders: d.orders,
    })),
    topProducts: sales.topProducts.map((p) => ({
      productId: p.id,
      name: p.name,
      quantity: p.quantity,
      revenue: p.revenue,
    })),
    cashiers,
    paymentMix: [...paymentMixMap.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function getCashierSalesMiniReport(options: {
  cashierId: string;
  storeId?: string;
  from: Date;
  to: Date;
}): Promise<CashierSalesMiniReport | null> {
  const user = await userRepo.getUser(options.cashierId);
  if (!user) return null;

  const [sessions, orders] = await Promise.all([
    sessionRepo.listSessions(options.storeId),
    orderRepo.listOrders(options.storeId),
  ]);
  const rows = aggregateCashierPerformance(
    sessions,
    orders,
    new Map([[user.id, user.name]]),
    options.from,
    options.to
  );
  const row = rows.find((r) => r.cashierId === options.cashierId) ?? {
    cashierId: user.id,
    cashierName: user.name,
    orderCount: 0,
    revenue: 0,
    avgTicket: 0,
    sessionCount: 0,
    closedSessionCount: 0,
    totalVariance: 0,
  };

  const sessionIds = new Set(
    sessions.filter((s) => s.cashier_id === options.cashierId).map((s) => s.id)
  );
  const inRange = completedPaidInRange(orders, options.from, options.to).filter(
    (o) => o.session_id && sessionIds.has(o.session_id)
  );

  const dayMap = new Map<string, { revenue: number; orders: number }>();
  for (const order of inRange) {
    const day = orderBusinessAt(order).slice(0, 10);
    const acc = dayMap.get(day) ?? { revenue: 0, orders: 0 };
    acc.revenue += order.total;
    acc.orders += 1;
    dayMap.set(day, acc);
  }

  const items = await loadOrderItems(inRange.map((o) => o.id));
  const products = await catalogRepo.listProducts();
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const revenueFactors = new Map(
    inRange.map((o) => [o.id, o.subtotal > 0 ? o.total / o.subtotal : 0])
  );
  const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const existing = productStats.get(item.product_id) ?? {
      name: productName.get(item.product_id) ?? "صنف غير معروف",
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += Number(item.quantity ?? 0);
    existing.revenue += netLineRevenue(item, revenueFactors);
    productStats.set(item.product_id, existing);
  }

  return {
    cashierId: row.cashierId,
    cashierName: row.cashierName,
    totalRevenue: row.revenue,
    orderCount: row.orderCount,
    avgOrderValue: row.avgTicket,
    sessionCount: row.sessionCount,
    closedSessionCount: row.closedSessionCount,
    totalVariance: row.totalVariance,
    revenueByDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders })),
    topProducts: [...productStats.entries()]
      .map(([productId, p]) => ({
        productId,
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
  };
}
