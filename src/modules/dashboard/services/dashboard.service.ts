import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as accountRepo from "@/lib/repositories/customer-account.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import { getDb } from "@/lib/repositories/client";
import type { CashierSession, Expense, Order, Product } from "@/lib/types";
import { listSupplierSummaries } from "@/modules/suppliers/services/supplier.service";

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  avgTicket: number;
  salesSparkline: { hour: string; total: number }[];
}

export interface PeriodSalesSummary {
  revenue: number;
  orderCount: number;
  avgTicket: number;
}

export interface OwnerFinanceSnapshot {
  customerOutstanding: number;
  customerCollectionsMtd: number;
  supplierOutstanding: number;
  supplierPaymentsMtd: number;
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

export interface InventoryValuationTotals {
  /** Σ(qty × sell price) — retail facing value of on-hand stock. */
  inventorySellValue: number;
  /** Σ(qty × last unit cost) — purchase/cost basis of on-hand stock. */
  inventoryCostValue: number;
  /** Sell − cost: expected gross profit if current stock sells at list price. */
  inventoryExpectedProfit: number;
}

export interface DashboardInventorySummary extends InventoryValuationTotals {
  lowStock: LowStockItem[];
  /** @deprecated Prefer inventorySellValue — kept for existing callers. */
  inventoryValue: number;
  nearExpiryCount: number;
}

export interface DashboardProfitSnapshot {
  inventoryExpectedProfit: number;
  expensesMtd: number;
  profitAfterExpenses: number;
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

/** Calendar month-to-date in UTC/ISO (aligned with existing dashboard day ranges). */
export function monthToDateRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
  return { from, to: now.toISOString() };
}

export function summarizePeriodSales(orders: Order[]): PeriodSalesSummary {
  const eligible = orders.filter(
    (o) => o.status === "completed" && o.payment_status !== "unpaid"
  );
  const revenue = eligible.reduce((s, o) => s + o.total, 0);
  const orderCount = eligible.length;
  return {
    revenue,
    orderCount,
    avgTicket: orderCount > 0 ? revenue / orderCount : 0,
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

/** Sell vs cost valuation for on-hand stock lines (pure — unit-tested). */
export function summarizeInventoryValuation(
  levels: { product_id: string; quantity: number }[],
  productMap: Map<string, Pick<Product, "base_price" | "last_unit_cost">>
): InventoryValuationTotals {
  let inventorySellValue = 0;
  let inventoryCostValue = 0;
  for (const level of levels) {
    const product = productMap.get(level.product_id);
    const qty = level.quantity;
    inventorySellValue += qty * (product?.base_price ?? 0);
    inventoryCostValue += qty * (product?.last_unit_cost ?? 0);
  }
  return {
    inventorySellValue,
    inventoryCostValue,
    inventoryExpectedProfit: inventorySellValue - inventoryCostValue,
  };
}

/** Approved expenses whose created_at falls in [from, to] inclusive. */
export function sumApprovedExpensesInRange(
  expenses: Pick<Expense, "amount" | "status" | "created_at">[],
  fromIso: string,
  toIso: string
): number {
  const fromTs = new Date(fromIso).getTime();
  const toTs = new Date(toIso).getTime();
  return expenses.reduce((sum, expense) => {
    if (expense.status !== "approved") return sum;
    const ts = new Date(expense.created_at).getTime();
    if (Number.isNaN(ts) || ts < fromTs || ts > toTs) return sum;
    return sum + expense.amount;
  }, 0);
}

export function buildProfitSnapshot(
  inventoryExpectedProfit: number,
  expensesMtd: number
): DashboardProfitSnapshot {
  return {
    inventoryExpectedProfit,
    expensesMtd,
    profitAfterExpenses: inventoryExpectedProfit - expensesMtd,
  };
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

export async function getMonthToDateSales(storeId: string): Promise<PeriodSalesSummary> {
  const { from, to } = monthToDateRange();
  const orders = await orderRepo.listOrders({
    storeId,
    status: "completed",
    from,
    to,
  });
  return summarizePeriodSales(orders);
}

export async function getOwnerFinanceSnapshot(
  storeId: string
): Promise<OwnerFinanceSnapshot> {
  const { from, to } = monthToDateRange();
  const [customersWithBalance, customerCollectionsMtd, supplierSummaries, supplierPayments] =
    await Promise.all([
      accountRepo.listCustomersWithBalance(),
      accountRepo.sumPaymentsForStoreInRange(storeId, from, to),
      listSupplierSummaries(storeId),
      paymentRepo.listPaymentsForStore(storeId),
    ]);

  const customerOutstanding = customersWithBalance.reduce(
    (sum, c) => sum + Math.max(0, c.account_balance),
    0
  );
  const supplierOutstanding = supplierSummaries.reduce(
    (sum, s) => sum + Math.max(0, s.balanceDue),
    0
  );
  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();
  const supplierPaymentsMtd = supplierPayments
    .filter((p) => {
      if (p.voided_at) return false;
      const ts = new Date(p.paid_at).getTime();
      return ts >= fromTs && ts <= toTs;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    customerOutstanding,
    customerCollectionsMtd,
    supplierOutstanding,
    supplierPaymentsMtd,
  };
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

  const valuation = summarizeInventoryValuation(rawLevels, productMap);

  const nearExpiryCount = batches.filter(
    (batch) => Boolean(batch.expiry_date) && !batch.is_expired && batch.remaining_quantity > 0
  ).length;

  return {
    lowStock,
    inventoryValue: valuation.inventorySellValue,
    ...valuation,
    nearExpiryCount,
  };
}

/** Month-to-date approved expenses for a store. */
export async function getMonthToDateExpenses(storeId: string): Promise<number> {
  const { from, to } = monthToDateRange();
  // Repo `to` appends T23:59:59 — pass calendar date only.
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);
  const expenses = await expenseRepo.listExpenses({
    storeId,
    status: "approved",
    from: fromDate,
    to: toDate,
  });
  return sumApprovedExpensesInRange(expenses, from, to);
}

export async function getDashboardProfitSnapshot(
  storeId: string,
  inventoryExpectedProfit: number
): Promise<DashboardProfitSnapshot> {
  const expensesMtd = await getMonthToDateExpenses(storeId);
  return buildProfitSnapshot(inventoryExpectedProfit, expensesMtd);
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
