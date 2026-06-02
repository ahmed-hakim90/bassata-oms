import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getDb } from "@/lib/repositories/client";
import type { CashierSession, Order } from "@/lib/types";

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  avgTicket: number;
  salesSparkline: { hour: string; total: number }[];
}

export async function getLiveStats(storeId: string): Promise<DashboardStats> {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const orders = (await orderRepo.listOrders(storeId)).filter(
    (o) => o.status === "completed" && o.created_at.startsWith(todayPrefix)
  );

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

export async function getActiveSessions(storeId?: string): Promise<CashierSession[]> {
  const sessions = await sessionRepo.listSessions(storeId);
  return sessions.filter((s) => s.status === "open");
}

export interface LowStockItem {
  productId: string;
  productName: string;
  quantity: number;
  reorderPoint: number;
}

export async function getSouqnaDashboardData(storeId: string) {
  const { countPendingSouqnaOrders, listRecentSouqnaOrders } = await import(
    "@/lib/repositories/souqna.repository"
  );
  const { getFeatureFlags, getSouqnaIntegrationSettings } = await import(
    "@/modules/system/services/settings.service"
  );
  const [flags, settings] = await Promise.all([
    getFeatureFlags(),
    getSouqnaIntegrationSettings(),
  ]);
  if (flags.souqna_integration === false || !settings.enable_souqna_channel) {
    return { pendingCount: 0, recentOrders: [] as Awaited<ReturnType<typeof listRecentSouqnaOrders>> };
  }
  if (settings.allowed_store_id && settings.allowed_store_id !== storeId) {
    return { pendingCount: 0, recentOrders: [] };
  }
  const [pendingCount, recentOrders] = await Promise.all([
    countPendingSouqnaOrders(storeId),
    listRecentSouqnaOrders(storeId, 5),
  ]);
  return { pendingCount, recentOrders };
}

export async function getLowStock(storeId: string): Promise<LowStockItem[]> {
  const rawLevels = await inventoryRepo.listStockLevels(storeId);
  const levels = Array.from(
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
  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return levels
    .filter((s) => s.quantity <= s.reorder_point)
    .map((s) => ({
      productId: s.product_id,
      productName: productMap.get(s.product_id) ?? s.product_id,
      quantity: s.quantity,
      reorderPoint: s.reorder_point,
    }))
    .sort((a, b) => a.quantity - b.quantity);
}

export async function getRecentOrders(storeId: string, limit = 8): Promise<Order[]> {
  return (await orderRepo.listOrders(storeId)).slice(0, limit);
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export async function getTopProducts(storeId: string, limit = 5): Promise<TopProduct[]> {
  const orders = (await orderRepo.listOrders(storeId)).filter(
    (o) => o.status === "completed"
  );
  const orderIds = orders.map((o) => o.id);
  const db = await getDb();
  const { data: items } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p.name]));
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
