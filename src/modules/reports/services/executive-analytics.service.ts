import { orderBusinessAt } from "@/lib/document-date";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import {
  getProfitReport,
  type ProductProfitRow,
  type ProfitReportDetail,
} from "@/modules/reports/services/profit-report.service";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import { listWasteWithProducts } from "@/modules/waste/services/waste.service";
import type { CashierSession, Order } from "@/lib/types";
import {
  computePeriodDelta,
  type PeriodDelta,
} from "@/modules/reports/lib/period-delta";

export type { PeriodDelta };
export { computePeriodDelta, formatPeriodDeltaLabel } from "@/modules/reports/lib/period-delta";

export interface CashierPerformanceRow {
  cashierId: string;
  cashierName: string;
  orderCount: number;
  revenue: number;
  avgTicket: number;
  sessionCount: number;
  closedSessionCount: number;
  totalVariance: number;
}

export interface BranchComparisonRow {
  storeId: string;
  storeName: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orderCount: number;
  wasteCost: number;
}

export interface HeatmapCell {
  hour: number;
  /** Weekday 0–6 (Sun–Sat) or YYYY-MM-DD */
  axisKey: string;
  axisLabel: string;
  revenue: number;
  orderCount: number;
}

export interface CategoryMarginRow {
  categoryId: string;
  categoryName: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  quantitySold: number;
}

export interface PnlLine {
  key: string;
  labelAr: string;
  amount: number;
  emphasis?: "total" | "subtotal" | "normal";
}

const WEEKDAY_LABELS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

/** Pure: equal-length range immediately before `from`…`to`. */
export function previousEqualLengthRange(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = Math.max(0, to.getTime() - from.getTime());
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

function sessionInRange(session: CashierSession, from: Date, to: Date): boolean {
  const opened = new Date(session.opened_at);
  if (opened >= from && opened <= to) return true;
  if (session.closed_at) {
    const closed = new Date(session.closed_at);
    if (closed >= from && closed <= to) return true;
  }
  return false;
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

/**
 * Aggregate cashier KPIs from sessions + orders (pure).
 * Orders map to cashier via session_id → cashier_id (all sessions, not only in-range).
 * Session variance counts closed sessions whose opened_at/closed_at falls in range.
 */
export function aggregateCashierPerformance(
  sessions: CashierSession[],
  orders: Order[],
  userNameById: Map<string, string>,
  from: Date,
  to: Date
): CashierPerformanceRow[] {
  const sessionCashierAll = new Map(sessions.map((s) => [s.id, s.cashier_id]));
  const sessionsInRange = sessions.filter((s) => sessionInRange(s, from, to));
  const ordersInRange = completedPaidInRange(orders, from, to);

  type Acc = {
    orderCount: number;
    revenue: number;
    sessionIds: Set<string>;
    closedSessionCount: number;
    totalVariance: number;
  };
  const byCashier = new Map<string, Acc>();

  const ensure = (cashierId: string): Acc => {
    const existing = byCashier.get(cashierId);
    if (existing) return existing;
    const created: Acc = {
      orderCount: 0,
      revenue: 0,
      sessionIds: new Set(),
      closedSessionCount: 0,
      totalVariance: 0,
    };
    byCashier.set(cashierId, created);
    return created;
  };

  for (const session of sessionsInRange) {
    const acc = ensure(session.cashier_id);
    acc.sessionIds.add(session.id);
    if (session.status === "closed") {
      acc.closedSessionCount += 1;
      acc.totalVariance += session.variance ?? 0;
    }
  }

  for (const order of ordersInRange) {
    if (!order.session_id) continue;
    const cashierId = sessionCashierAll.get(order.session_id);
    if (!cashierId) continue;
    const acc = ensure(cashierId);
    acc.orderCount += 1;
    acc.revenue += order.total;
  }

  return [...byCashier.entries()]
    .map(([cashierId, acc]) => ({
      cashierId,
      cashierName: userNameById.get(cashierId) ?? "—",
      orderCount: acc.orderCount,
      revenue: acc.revenue,
      avgTicket: acc.orderCount > 0 ? acc.revenue / acc.orderCount : 0,
      sessionCount: acc.sessionIds.size,
      closedSessionCount: acc.closedSessionCount,
      totalVariance: acc.totalVariance,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getCashierPerformanceReport(options: {
  storeId?: string;
  from: Date;
  to: Date;
}): Promise<CashierPerformanceRow[]> {
  const [sessions, orders, users] = await Promise.all([
    sessionRepo.listSessions(options.storeId),
    orderRepo.listOrders(options.storeId),
    userRepo.listUsers(),
  ]);
  const userNameById = new Map(users.map((u) => [u.id, u.name]));
  return aggregateCashierPerformance(
    sessions,
    orders,
    userNameById,
    options.from,
    options.to
  );
}

export async function getBranchComparisonReport(options: {
  storeId?: string;
  days: number;
  from?: string;
  to?: string;
  fromDate: Date;
  toDate: Date;
}): Promise<BranchComparisonRow[]> {
  const reportOpts = {
    storeId: options.storeId,
    days: options.days,
    from: options.from,
    to: options.to,
  };
  const [sales, stores, wasteRecords, products] = await Promise.all([
    getSalesReport(reportOpts),
    storeRepo.listStores(),
    listWasteWithProducts(options.storeId),
    catalogRepo.listProducts(),
  ]);

  const productCostMap = new Map(products.map((p) => [p.id, p.last_unit_cost ?? 0]));
  const wasteInRange = wasteRecords.filter((r) => {
    const d = new Date(r.created_at);
    return d >= options.fromDate && d <= options.toDate;
  });
  const wasteByStore = new Map<string, number>();
  for (const r of wasteInRange) {
    const cost = r.quantity * (productCostMap.get(r.product_id) ?? 0);
    wasteByStore.set(r.store_id, (wasteByStore.get(r.store_id) ?? 0) + cost);
  }

  const orderCountByStore = new Map<string, number>();
  const orders = completedPaidInRange(
    await orderRepo.listOrders(options.storeId),
    options.fromDate,
    options.toDate
  );
  for (const o of orders) {
    orderCountByStore.set(o.store_id, (orderCountByStore.get(o.store_id) ?? 0) + 1);
  }

  const storeIds = options.storeId
    ? stores.filter((s) => s.id === options.storeId)
    : stores;

  return storeIds
    .map((store) => {
      const salesRow = sales.revenueByStore.find((r) => r.storeId === store.id);
      const revenue = salesRow?.revenue ?? 0;
      const cost = salesRow?.cost ?? 0;
      const profit = salesRow?.profit ?? revenue - cost;
      return {
        storeId: store.id,
        storeName: store.name,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        orderCount: orderCountByStore.get(store.id) ?? 0,
        wasteCost: wasteByStore.get(store.id) ?? 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getPeriodComparisonReport(options: {
  storeId?: string;
  days: number;
  from?: string;
  to?: string;
  fromDate: Date;
  toDate: Date;
}): Promise<{
  currentRange: { from: string; to: string };
  previousRange: { from: string; to: string };
  metrics: {
    key: string;
    labelAr: string;
    current: number;
    previous: number;
    delta: number;
    deltaPct: number | null;
  }[];
}> {
  const prev = previousEqualLengthRange(options.fromDate, options.toDate);
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
  const prevFromStr = toIsoDate(prev.from);
  const prevToStr = toIsoDate(prev.to);
  const currFromStr = options.from ?? toIsoDate(options.fromDate);
  const currToStr = options.to ?? toIsoDate(options.toDate);

  const [currentSales, previousSales] = await Promise.all([
    getSalesReport({
      storeId: options.storeId,
      days: options.days,
      from: currFromStr,
      to: currToStr,
    }),
    getSalesReport({
      storeId: options.storeId,
      from: prevFromStr,
      to: prevToStr,
    }),
  ]);

  const pairs: { key: string; labelAr: string; current: number; previous: number }[] = [
    {
      key: "revenue",
      labelAr: "الإيراد",
      current: currentSales.totalRevenue,
      previous: previousSales.totalRevenue,
    },
    {
      key: "orders",
      labelAr: "الطلبات",
      current: currentSales.orderCount,
      previous: previousSales.orderCount,
    },
    {
      key: "avgTicket",
      labelAr: "متوسط الطلب",
      current: currentSales.avgOrderValue,
      previous: previousSales.avgOrderValue,
    },
    {
      key: "grossProfit",
      labelAr: "إجمالي الربح",
      current: currentSales.grossProfit,
      previous: previousSales.grossProfit,
    },
    {
      key: "avgMargin",
      labelAr: "متوسط الهامش %",
      current: currentSales.avgMargin,
      previous: previousSales.avgMargin,
    },
  ];

  return {
    currentRange: { from: currFromStr, to: currToStr },
    previousRange: { from: prevFromStr, to: prevToStr },
    metrics: pairs.map((p) => ({
      key: p.key,
      labelAr: p.labelAr,
      ...computePeriodDelta(p.current, p.previous),
    })),
  };
}

/** Pure: bucket orders into hour × weekday|day cells. Uses created_at for hour. */
export function buildHeatmapCells(
  orders: Pick<Order, "created_at" | "total" | "document_date">[],
  mode: "weekday" | "day"
): HeatmapCell[] {
  const map = new Map<string, HeatmapCell>();

  for (const order of orders) {
    const at = new Date(order.created_at);
    const hour = at.getHours();
    let axisKey: string;
    let axisLabel: string;
    if (mode === "weekday") {
      const wd = at.getDay();
      axisKey = String(wd);
      axisLabel = WEEKDAY_LABELS_AR[wd] ?? String(wd);
    } else {
      axisKey = orderBusinessAt(order).slice(0, 10);
      axisLabel = axisKey;
    }
    const key = `${axisKey}|${hour}`;
    const existing = map.get(key) ?? {
      hour,
      axisKey,
      axisLabel,
      revenue: 0,
      orderCount: 0,
    };
    existing.revenue += order.total;
    existing.orderCount += 1;
    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => {
    const axisCmp = a.axisKey.localeCompare(b.axisKey, undefined, { numeric: true });
    if (axisCmp !== 0) return axisCmp;
    return a.hour - b.hour;
  });
}

export async function getSalesHeatmapReport(options: {
  storeId?: string;
  from: Date;
  to: Date;
  mode?: "weekday" | "day";
}): Promise<{
  mode: "weekday" | "day";
  cells: HeatmapCell[];
  maxRevenue: number;
  axisKeys: { key: string; label: string }[];
}> {
  const mode = options.mode ?? "weekday";
  const orders = completedPaidInRange(
    await orderRepo.listOrders(options.storeId),
    options.from,
    options.to
  );
  const cells = buildHeatmapCells(orders, mode);
  const maxRevenue = cells.reduce((m, c) => Math.max(m, c.revenue), 0);

  let axisKeys: { key: string; label: string }[];
  if (mode === "weekday") {
    axisKeys = WEEKDAY_LABELS_AR.map((label, i) => ({ key: String(i), label }));
  } else {
    const seen = new Map<string, string>();
    for (const c of cells) seen.set(c.axisKey, c.axisLabel);
    axisKeys = [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, label]) => ({ key, label }));
  }

  return { mode, cells, maxRevenue, axisKeys };
}

/** Pure: roll product margins up to categories. */
export function aggregateCategoryMargins(
  products: ProductProfitRow[],
  productCategoryById: Map<string, string>,
  categoryNameById: Map<string, string>
): CategoryMarginRow[] {
  const map = new Map<
    string,
    { revenue: number; cost: number; quantitySold: number }
  >();

  for (const p of products) {
    const categoryId = productCategoryById.get(p.productId) ?? "uncategorized";
    const existing = map.get(categoryId) ?? {
      revenue: 0,
      cost: 0,
      quantitySold: 0,
    };
    existing.revenue += p.revenue;
    existing.cost += p.cost;
    existing.quantitySold += p.quantitySold;
    map.set(categoryId, existing);
  }

  return [...map.entries()]
    .map(([categoryId, data]) => {
      const profit = data.revenue - data.cost;
      return {
        categoryId,
        categoryName:
          categoryId === "uncategorized"
            ? "بدون تصنيف"
            : (categoryNameById.get(categoryId) ?? "—"),
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        quantitySold: data.quantitySold,
      };
    })
    .sort((a, b) => b.margin - a.margin || b.profit - a.profit);
}

export async function getMarginsRankingReport(options: {
  storeId?: string;
  days: number;
  from?: string;
  to?: string;
}): Promise<{
  products: ProductProfitRow[];
  categories: CategoryMarginRow[];
  profit: ProfitReportDetail;
}> {
  const [profit, catalogProducts, categories] = await Promise.all([
    getProfitReport(options),
    catalogRepo.listProducts(),
    catalogRepo.listCategories(),
  ]);
  const productCategoryById = new Map(
    catalogProducts.map((p) => [p.id, p.category_id] as const)
  );
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name] as const));
  return {
    products: [...profit.products].sort((a, b) => b.margin - a.margin || b.profit - a.profit),
    categories: aggregateCategoryMargins(
      profit.products,
      productCategoryById,
      categoryNameById
    ),
    profit,
  };
}

/** Build simple P&L lines from getProfitReport output. */
export function buildPnlStatement(profit: ProfitReportDetail): {
  lines: PnlLine[];
  estimatedNet: number;
} {
  const estimatedNet =
    profit.grossProfit - profit.totalExpenses - profit.wasteCost - profit.refunds;
  const lines: PnlLine[] = [
    { key: "revenue", labelAr: "الإيراد", amount: profit.revenue, emphasis: "normal" },
    { key: "cogs", labelAr: "تكلفة البضاعة (COGS)", amount: -profit.cogs, emphasis: "normal" },
    {
      key: "gross",
      labelAr: "إجمالي الربح",
      amount: profit.grossProfit,
      emphasis: "subtotal",
    },
    {
      key: "expenses",
      labelAr: "المصروفات",
      amount: -profit.totalExpenses,
      emphasis: "normal",
    },
    { key: "waste", labelAr: "الهالك", amount: -profit.wasteCost, emphasis: "normal" },
    { key: "refunds", labelAr: "المرتجعات", amount: -profit.refunds, emphasis: "normal" },
    {
      key: "net",
      labelAr: "صافي تقديري",
      amount: estimatedNet,
      emphasis: "total",
    },
  ];
  return { lines, estimatedNet };
}

export async function getPnlReport(options: {
  storeId?: string;
  days: number;
  from?: string;
  to?: string;
}): Promise<{
  profit: ProfitReportDetail;
  lines: PnlLine[];
  estimatedNet: number;
}> {
  const profit = await getProfitReport(options);
  const { lines, estimatedNet } = buildPnlStatement(profit);
  return { profit, lines, estimatedNet };
}
