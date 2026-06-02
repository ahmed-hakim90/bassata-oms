import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getDb } from "@/lib/repositories/client";

export interface SalesKpi {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  avgMargin: number;
  orderCount: number;
  avgOrderValue: number;
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
  topVariants: {
    name: string;
    productName: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }[];
  revenueByDay: { date: string; revenue: number; cost: number; profit: number; orders: number }[];
  revenueByStore: { storeId: string; storeName: string; revenue: number; cost: number; profit: number }[];
}

export async function getSalesReport(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}): Promise<SalesKpi> {
  const days = options?.days ?? 30;
  let rangeStart: Date;
  let rangeEnd: Date;
  if (options?.from) {
    rangeStart = new Date(options.from);
    rangeEnd = options.to ? new Date(`${options.to}T23:59:59`) : new Date();
  } else {
    rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - days);
    rangeEnd = new Date();
  }

  const orders = (await orderRepo.listOrders(options?.storeId)).filter(
    (o) =>
      o.status === "completed" &&
      new Date(o.created_at) >= rangeStart &&
      new Date(o.created_at) <= rangeEnd
  );

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  const db = await getDb();
  const orderIds = orders.map((o) => o.id);
  const { data: items } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const variantRows = await Promise.all(
    products.map(async (p) => ({
      productId: p.id,
      variants: await catalogRepo.listVariants(p.id),
    }))
  );
  const variantNameMap = new Map<string, string>();
  for (const row of variantRows) {
    for (const v of row.variants) {
      variantNameMap.set(v.id, v.name);
    }
  }

  const totalCost = (items ?? []).reduce((s, item) => s + Number(item.line_cost ?? 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const productStats = new Map<
    string,
    { name: string; quantity: number; revenue: number; cost: number }
  >();
  for (const item of items ?? []) {
    const existing = productStats.get(item.product_id) ?? {
      name: productMap.get(item.product_id) ?? "Unknown",
      quantity: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.line_total);
    existing.cost += Number(item.line_cost ?? 0);
    productStats.set(item.product_id, existing);
  }

  const topProducts = [...productStats.values()]
    .map((p) => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const variantStats = new Map<
    string,
    { name: string; productName: string; quantity: number; revenue: number; cost: number }
  >();
  for (const item of items ?? []) {
    if (!item.variant_id) continue;
    const key = `${item.product_id}:${item.variant_id}`;
    const productName = productMap.get(item.product_id) ?? "Unknown";
    const variantName = variantNameMap.get(item.variant_id) ?? "Variant";
    const existing = variantStats.get(key) ?? {
      name: variantName,
      productName,
      quantity: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.line_total);
    existing.cost += Number(item.line_cost ?? 0);
    variantStats.set(key, existing);
  }

  const topVariants = [...variantStats.values()]
    .map((v) => ({
      ...v,
      profit: v.revenue - v.cost,
      margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const dayMap = new Map<string, { revenue: number; cost: number; orders: number }>();
  const orderCostMap = new Map<string, number>();
  for (const item of items ?? []) {
    orderCostMap.set(
      item.order_id,
      (orderCostMap.get(item.order_id) ?? 0) + Number(item.line_cost ?? 0)
    );
  }
  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    const existing = dayMap.get(date) ?? { revenue: 0, cost: 0, orders: 0 };
    existing.revenue += order.total;
    existing.cost += orderCostMap.get(order.id) ?? 0;
    existing.orders += 1;
    dayMap.set(date, existing);
  }

  const revenueByDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      orders: data.orders,
    }));

  const stores = await storeRepo.listStores();
  const revenueByStore = stores.map((store) => {
    const storeOrders = orders.filter((o) => o.store_id === store.id);
    const revenue = storeOrders.reduce((s, o) => s + o.total, 0);
    const cost = storeOrders.reduce(
      (s, o) => s + (orderCostMap.get(o.id) ?? 0),
      0
    );
    return {
      storeId: store.id,
      storeName: store.name,
      revenue,
      cost,
      profit: revenue - cost,
    };
  });

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    avgMargin,
    orderCount,
    avgOrderValue,
    topProducts,
    topVariants,
    revenueByDay,
    revenueByStore,
  };
}
