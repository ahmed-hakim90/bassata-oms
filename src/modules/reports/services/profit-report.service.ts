import { orderBusinessAt } from "@/lib/document-date";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getDb } from "@/lib/repositories/client";
import { getTotalExpenses, getExpensesByCostCenter } from "@/modules/reports/services/expense-report.service";
import { listWasteWithProducts } from "@/modules/waste/services/waste.service";
import {
  summarizeInventoryValuation,
  type InventoryValuationTotals,
} from "@/modules/dashboard/services/dashboard.service";
import type { Order, Product, PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";

export interface InvoiceProfitRow {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  itemCount: number;
}

/** Expected margin if purchase lines were sold at current list price. */
export interface PurchaseInvoiceProfitRow {
  invoiceId: string;
  invoiceNumber: string;
  receivedAt: string;
  purchaseCost: number;
  expectedSellValue: number;
  expectedProfit: number;
  margin: number;
  itemCount: number;
}

export interface DayProfitRow {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orders: number;
}

export interface ProductProfitRow {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface ProfitReportDetail {
  revenue: number;
  cogs: number;
  expensesByCostCenter: { name: string; amount: number }[];
  totalExpenses: number;
  purchases: number;
  wasteCost: number;
  refunds: number;
  grossProfit: number;
  estimatedNetProfit: number;
  orderCount: number;
  avgOrderProfit: number;
  inventory: InventoryValuationTotals;
  invoices: InvoiceProfitRow[];
  purchaseInvoices: PurchaseInvoiceProfitRow[];
  byDay: DayProfitRow[];
  products: ProductProfitRow[];
  highestProfitProducts: ProductProfitRow[];
  highestSellingProducts: ProductProfitRow[];
}

type OrderItemRow = {
  order_id: string;
  product_id: string;
  quantity: number | string | null;
  line_total: number | string | null;
  line_cost: number | string | null;
};

function dateRange(options?: { days?: number; from?: string; to?: string }) {
  const days = options?.days ?? 30;
  let from: Date;
  let to: Date;
  if (options?.from) {
    from = new Date(options.from);
    to = options.to ? new Date(`${options.to}T23:59:59`) : new Date();
  } else {
    from = new Date();
    from.setDate(from.getDate() - days);
    to = new Date();
  }
  return { from, to };
}

function getNetLineRevenue(
  item: { order_id: string; line_total: number | string | null },
  revenueFactors: Map<string, number>
) {
  const grossLineTotal = Number(item.line_total ?? 0);
  const factor = revenueFactors.get(item.order_id);
  if (!factor || factor <= 0) return grossLineTotal;
  return grossLineTotal * factor;
}

/** Pure: expected profit per sales invoice from line costs. */
export function buildInvoiceProfitRows(
  orders: Pick<Order, "id" | "order_number" | "created_at" | "total" | "document_date">[],
  items: OrderItemRow[]
): InvoiceProfitRow[] {
  const orderCostMap = new Map<string, number>();
  const orderItemCount = new Map<string, number>();
  for (const item of items) {
    orderCostMap.set(
      item.order_id,
      (orderCostMap.get(item.order_id) ?? 0) + Number(item.line_cost ?? 0)
    );
    orderItemCount.set(
      item.order_id,
      (orderItemCount.get(item.order_id) ?? 0) + 1
    );
  }

  return orders
    .map((order) => {
      const revenue = order.total;
      const cost = orderCostMap.get(order.id) ?? 0;
      const profit = revenue - cost;
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        createdAt: orderBusinessAt(order),
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        itemCount: orderItemCount.get(order.id) ?? 0,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Pure: expected profit per received purchase invoice =
 * Σ(qty × list sell price) − purchase cost (landed when available).
 */
export function buildPurchaseInvoiceProfitRows(
  invoices: Pick<
    PurchaseInvoice,
    "id" | "invoice_number" | "received_at" | "total" | "status"
  >[],
  lines: Pick<
    PurchaseInvoiceLine,
    "invoice_id" | "product_id" | "quantity" | "line_total" | "landed_line_total"
  >[],
  productSellPriceById: Map<string, number>
): PurchaseInvoiceProfitRow[] {
  const linesByInvoice = new Map<string, typeof lines>();
  for (const line of lines) {
    const existing = linesByInvoice.get(line.invoice_id) ?? [];
    existing.push(line);
    linesByInvoice.set(line.invoice_id, existing);
  }

  return invoices
    .filter((inv) => inv.status === "received" && inv.received_at)
    .map((invoice) => {
      const invLines = linesByInvoice.get(invoice.id) ?? [];
      const expectedSellValue = invLines.reduce(
        (sum, line) =>
          sum + line.quantity * (productSellPriceById.get(line.product_id) ?? 0),
        0
      );
      const landedSum = invLines.reduce(
        (sum, line) => sum + Number(line.landed_line_total ?? line.line_total ?? 0),
        0
      );
      const purchaseCost = landedSum > 0 ? landedSum : invoice.total;
      const expectedProfit = expectedSellValue - purchaseCost;
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        receivedAt: invoice.received_at as string,
        purchaseCost,
        expectedSellValue,
        expectedProfit,
        margin:
          expectedSellValue > 0 ? (expectedProfit / expectedSellValue) * 100 : 0,
        itemCount: invLines.length,
      };
    })
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/** Pure: daily sales + profit totals. */
export function buildDayProfitRows(
  orders: Pick<Order, "id" | "created_at" | "total" | "document_date">[],
  items: OrderItemRow[]
): DayProfitRow[] {
  const orderCostMap = new Map<string, number>();
  for (const item of items) {
    orderCostMap.set(
      item.order_id,
      (orderCostMap.get(item.order_id) ?? 0) + Number(item.line_cost ?? 0)
    );
  }

  const dayMap = new Map<string, { revenue: number; cost: number; orders: number }>();
  for (const order of orders) {
    const date = orderBusinessAt(order).slice(0, 10);
    const existing = dayMap.get(date) ?? { revenue: 0, cost: 0, orders: 0 };
    existing.revenue += order.total;
    existing.cost += orderCostMap.get(order.id) ?? 0;
    existing.orders += 1;
    dayMap.set(date, existing);
  }

  return [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => {
      const profit = data.revenue - data.cost;
      return {
        date,
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        orders: data.orders,
      };
    });
}

/** Pure: product sales with realized profit from line costs. */
export function buildProductProfitRows(
  orders: Pick<Order, "id" | "subtotal" | "total">[],
  items: OrderItemRow[],
  productNameById: Map<string, string>
): ProductProfitRow[] {
  const revenueFactorByOrder = new Map(
    orders.map((order) => [
      order.id,
      order.subtotal > 0 ? order.total / order.subtotal : 0,
    ])
  );

  const stats = new Map<
    string,
    { quantitySold: number; revenue: number; cost: number }
  >();

  for (const item of items) {
    const existing = stats.get(item.product_id) ?? {
      quantitySold: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantitySold += Number(item.quantity ?? 0);
    existing.revenue += getNetLineRevenue(item, revenueFactorByOrder);
    existing.cost += Number(item.line_cost ?? 0);
    stats.set(item.product_id, existing);
  }

  return [...stats.entries()]
    .map(([productId, data]) => {
      const profit = data.revenue - data.cost;
      return {
        productId,
        name: productNameById.get(productId) ?? "Unknown",
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export function rankHighestProfitProducts(
  products: ProductProfitRow[],
  limit = 10
): ProductProfitRow[] {
  return [...products].sort((a, b) => b.profit - a.profit).slice(0, limit);
}

export function rankHighestSellingProducts(
  products: ProductProfitRow[],
  limit = 10
): ProductProfitRow[] {
  return [...products].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

async function getPurchasesInRange(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const rangeStart = from.getTime();
  const rangeEnd = to.getTime();

  const invoices = (await purchaseRepo.listPurchases(options?.storeId)).filter((p) => {
    if (p.status !== "received" || !p.received_at) return false;
    const d = new Date(p.received_at).getTime();
    return d >= rangeStart && d <= rangeEnd;
  });

  const fromStr = options?.from ?? from.toISOString().slice(0, 10);
  const toStr = options?.to ?? to.toISOString().slice(0, 10);
  const sessionInventoryPurchases = (
    await expenseRepo.listExpenses({
      storeId: options?.storeId,
      from: fromStr,
      to: toStr,
      status: "approved",
    })
  )
    .filter((e) => e.inventory_item_id)
    .reduce((s, e) => s + e.amount, 0);

  const purchaseInvoicesTotal = invoices.reduce((s, p) => s + p.total, 0);

  return {
    invoices,
    purchasesTotal: purchaseInvoicesTotal + sessionInventoryPurchases,
  };
}

async function getInventorySnapshot(storeId?: string): Promise<InventoryValuationTotals> {
  const products = await catalogRepo.listProducts();
  let levels: Awaited<ReturnType<typeof inventoryRepo.listStockLevels>>;
  if (storeId) {
    levels = await inventoryRepo.listStockLevels(storeId);
  } else {
    const stores = await storeRepo.listStores();
    const all = await Promise.all(stores.map((s) => inventoryRepo.listStockLevels(s.id)));
    levels = all.flat();
  }

  const productMap = new Map(products.map((p: Product) => [p.id, p] as const));
  return summarizeInventoryValuation(levels, productMap);
}

export async function getProfitReport(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}): Promise<ProfitReportDetail> {
  const reportOpts = {
    storeId: options?.storeId,
    days: options?.days ?? 30,
    from: options?.from,
    to: options?.to,
  };
  const { from, to } = dateRange(options);

  const [
    allOrders,
    totalExpenses,
    expensesByCenter,
    wasteRecords,
    products,
    purchaseBundle,
    inventory,
  ] = await Promise.all([
    orderRepo.listOrders(options?.storeId),
    getTotalExpenses(reportOpts),
    getExpensesByCostCenter(reportOpts),
    listWasteWithProducts(options?.storeId),
    catalogRepo.listProducts(),
    getPurchasesInRange(options),
    getInventorySnapshot(options?.storeId),
  ]);

  const purchases = purchaseBundle.purchasesTotal;
  const purchaseInvoicesInRange = purchaseBundle.invoices;

  const completedOrders = allOrders.filter(
    (o) =>
      o.status === "completed" &&
      o.payment_status !== "unpaid" &&
      new Date(orderBusinessAt(o)) >= from &&
      new Date(orderBusinessAt(o)) <= to
  );

  const refundOrders = allOrders.filter((o) => {
    const d = new Date(orderBusinessAt(o));
    return (o.status === "refunded" || o.status === "voided") && d >= from && d <= to;
  });
  const refunds = refundOrders.reduce((s, o) => s + o.total, 0);

  const productCostMap = new Map(products.map((p) => [p.id, p.last_unit_cost ?? 0]));
  const wasteInRange = wasteRecords.filter((r) => {
    const d = new Date(r.created_at);
    return d >= from && d <= to;
  });
  const wasteCost = wasteInRange.reduce(
    (s, r) => s + r.quantity * (productCostMap.get(r.product_id) ?? 0),
    0
  );

  const db = await getDb();
  const orderIds = completedOrders.map((o) => o.id);
  const [{ data: items }, purchaseLines] = await Promise.all([
    orderIds.length > 0
      ? db.from("order_items").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [] as OrderItemRow[] }),
    purchaseRepo.getPurchaseLinesForInvoices(purchaseInvoicesInRange.map((p) => p.id)),
  ]);

  const orderItems = (items ?? []) as OrderItemRow[];
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const productSellPriceById = new Map(products.map((p) => [p.id, p.base_price ?? 0]));

  const invoices = buildInvoiceProfitRows(completedOrders, orderItems);
  const purchaseInvoices = buildPurchaseInvoiceProfitRows(
    purchaseInvoicesInRange,
    purchaseLines,
    productSellPriceById
  );
  const byDay = buildDayProfitRows(completedOrders, orderItems);
  const productRows = buildProductProfitRows(
    completedOrders,
    orderItems,
    productNameById
  );

  const revenue = completedOrders.reduce((s, o) => s + o.total, 0);
  const cogs = orderItems.reduce((s, item) => s + Number(item.line_cost ?? 0), 0);
  const grossProfit = revenue - cogs;
  const estimatedNetProfit = grossProfit - totalExpenses - wasteCost;
  const orderCount = completedOrders.length;
  const avgOrderProfit = orderCount > 0 ? grossProfit / orderCount : 0;

  return {
    revenue,
    cogs,
    expensesByCostCenter: expensesByCenter,
    totalExpenses,
    purchases,
    wasteCost,
    refunds,
    grossProfit,
    estimatedNetProfit,
    orderCount,
    avgOrderProfit,
    inventory,
    invoices,
    purchaseInvoices,
    byDay,
    products: productRows,
    highestProfitProducts: rankHighestProfitProducts(productRows, 10),
    highestSellingProducts: rankHighestSellingProducts(productRows, 10),
  };
}

export async function getHighestWasteReport(storeId?: string, days = 30) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const records = (await listWasteWithProducts(storeId)).filter(
    (r) => new Date(r.created_at) >= from
  );
  const products = await catalogRepo.listProducts();
  const productCostMap = new Map(products.map((p) => [p.id, p.last_unit_cost ?? 0]));

  const byProduct = new Map<
    string,
    { productId: string; name: string; quantity: number; cost: number; reason: string }
  >();
  for (const r of records) {
    const existing = byProduct.get(r.product_id) ?? {
      productId: r.product_id,
      name: r.productName,
      quantity: 0,
      cost: 0,
      reason: r.reason_code,
    };
    existing.quantity += r.quantity;
    existing.cost += r.quantity * (productCostMap.get(r.product_id) ?? 0);
    byProduct.set(r.product_id, existing);
  }
  return [...byProduct.values()].sort((a, b) => b.cost - a.cost);
}

export function productRankingsFromReport(report: ProfitReportDetail) {
  return {
    highestProfit: report.highestProfitProducts.slice(0, 5),
    highestSelling: report.highestSellingProducts.slice(0, 5),
    highestCost: [...report.products].sort((a, b) => b.cost - a.cost).slice(0, 5),
  };
}

export async function getProductRankings(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  return productRankingsFromReport(await getProfitReport(options));
}
