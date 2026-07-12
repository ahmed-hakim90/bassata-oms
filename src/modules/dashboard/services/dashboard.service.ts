import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getDb } from "@/lib/repositories/client";
import type { CashierSession, Order, Product } from "@/lib/types";

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  avgTicket: number;
  salesSparkline: { hour: string; total: number }[];
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  quantity: number;
  reorderPoint: number;
}

export interface DashboardInventorySummary {
  lowStock: LowStockItem[];
  inventoryValue: number;
  nearExpiryCount: number;
}

export interface DashboardSalesBundle {
  stats: DashboardStats;
  topProducts: TopProduct[];
  recentOrders: Order[];
}

function todayRange() {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  return {
    from: `${todayPrefix}T00:00:00.000Z`,
    to: `${todayPrefix}T23:59:59.999Z`,
  };
}

function buildLiveStats(orders: Order[]): DashboardStats {
  const todaySales = orders.reduce((s, o) => s + o.total, 0);
  const avgTicket = orders.length ? todaySales / orders.length : 0;

  const buckets = new Map<string, number>();
  for (let h = 8; h <= 22; h++) {
    buckets.set(`${String(h).padStart(2, "0")}:00`, 0);
  }

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours();
    const key = `${String(hour).padStart(2, "0")}:00`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + order.total);
  }

  return {
    todaySales,
    todayOrders: orders.length,
    avgTicket,
    salesSparkline: Array.from(buckets.entries()).map(([hour, total]) => ({
      hour,
      total,
    })),
  };
}

async function buildTopProducts(
  orders: Order[],
  productMap: Map<string, string>,
  limit: number
): Promise<TopProduct[]> {
  const orderIds = orders.map((o) => o.id);
  const db = await getDb();
  const { data: items } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const agg = new Map<string, TopProduct>();
  for (const item of items ?? []) {
    const existing = agg.get(item.product_id) ?? {
      productId: item.product_id,
      name: productMap.get(item.product_id) ?? item.product_id,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.line_total);
    agg.set(item.product_id, existing);
  }

  return Array.from(agg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function aggregateStockLevels(
  rawLevels: Awaited<ReturnType<typeof inventoryRepo.listStockLevels>>
) {
  return Array.from(
    rawLevels
      .reduce((map, level) => {
        const key = `${level.product_id}:${level.variant_id ?? ""}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...level });
        } else {
          existing.quantity += level.quantity;
          existing.reorder_point += level.reorder_point;
        }
        return map;
      }, new Map<string, (typeof rawLevels)[number]>())
      .values()
  );
}

export async function getLiveStats(storeId: string): Promise<DashboardStats> {
  const { from, to } = todayRange();
  const orders = await orderRepo.listOrders({
    storeId,
    status: "completed",
    from,
    to,
  });
  return buildLiveStats(orders);
}

export async function getActiveSessions(storeId?: string): Promise<CashierSession[]> {
  return sessionRepo.listOpenSessions(storeId);
}

export async function getLowStock(storeId: string): Promise<LowStockItem[]> {
  const summary = await getDashboardInventory(storeId);
  return summary.lowStock;
}

/** One stock/products/batches pass for dashboard KPIs. */
export async function getDashboardInventory(
  storeId: string,
  products?: Product[]
): Promise<DashboardInventorySummary> {
  const [rawLevels, batches, productList] = await Promise.all([
    inventoryRepo.listStockLevels(storeId),
    inventoryRepo.listInventoryBatches(storeId),
    products ? Promise.resolve(products) : catalogRepo.listProducts(),
  ]);

  const productMap = new Map(productList.map((p) => [p.id, p]));
  const levels = aggregateStockLevels(rawLevels);

  const lowStock = levels
    .filter((s) => s.quantity <= s.reorder_point)
    .map((s) => ({
      productId: s.product_id,
      productName: productMap.get(s.product_id)?.name ?? s.product_id,
      quantity: s.quantity,
      reorderPoint: s.reorder_point,
    }))
    .sort((a, b) => a.quantity - b.quantity);

  const inventoryValue = rawLevels.reduce((total, level) => {
    const cost = productMap.get(level.product_id)?.base_price ?? 0;
    return total + level.quantity * cost;
  }, 0);

  const nearExpiryCount = batches.filter(
    (batch) => Boolean(batch.expiry_date) && !batch.is_expired && batch.remaining_quantity > 0
  ).length;

  return { lowStock, inventoryValue, nearExpiryCount };
}

export async function getRecentOrders(storeId: string, limit = 8): Promise<Order[]> {
  return orderRepo.listOrders({ storeId, limit });
}

/** Top products for today's completed sales (live dashboard scope). */
export async function getTopProducts(storeId: string, limit = 5): Promise<TopProduct[]> {
  const { from, to } = todayRange();
  const [orders, products] = await Promise.all([
    orderRepo.listOrders({
      storeId,
      status: "completed",
      from,
      to,
    }),
    catalogRepo.listProducts(),
  ]);
  return buildTopProducts(
    orders,
    new Map(products.map((p) => [p.id, p.name])),
    limit
  );
}

/**
 * Dashboard sales panel: one today's-completed fetch for stats + top products,
 * plus a limited recent-orders query. Shares product list with inventory when provided.
 */
export async function getDashboardSales(
  storeId: string,
  options?: { topLimit?: number; recentLimit?: number; products?: Product[] }
): Promise<DashboardSalesBundle> {
  const { from, to } = todayRange();
  const topLimit = options?.topLimit ?? 5;
  const recentLimit = options?.recentLimit ?? 8;

  const [todayOrders, recentOrders, productList] = await Promise.all([
    orderRepo.listOrders({
      storeId,
      status: "completed",
      from,
      to,
    }),
    orderRepo.listOrders({ storeId, limit: recentLimit }),
    options?.products ? Promise.resolve(options.products) : catalogRepo.listProducts(),
  ]);

  const productNameMap = new Map(productList.map((p) => [p.id, p.name]));
  const [topProducts] = await Promise.all([
    buildTopProducts(todayOrders, productNameMap, topLimit),
  ]);

  return {
    stats: buildLiveStats(todayOrders),
    topProducts,
    recentOrders,
  };
}
