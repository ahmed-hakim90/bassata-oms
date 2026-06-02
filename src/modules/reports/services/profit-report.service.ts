import * as orderRepo from "@/lib/repositories/order.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import { getTotalExpenses, getExpensesByCostCenter } from "@/modules/reports/services/expense-report.service";
import { listWasteWithProducts } from "@/modules/waste/services/waste.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getProductProfitabilityReport } from "@/modules/reports/services/profitability-report.service";

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

async function getPurchasesTotal(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const rangeStart = from.getTime();
  const rangeEnd = to.getTime();

  const invoices = await purchaseRepo.listPurchases(options?.storeId);
  const purchaseInvoicesTotal = invoices
    .filter((p) => {
      if (p.status !== "received" || !p.received_at) return false;
      const d = new Date(p.received_at).getTime();
      return d >= rangeStart && d <= rangeEnd;
    })
    .reduce((s, p) => s + p.total, 0);

  const fromStr = options?.from ?? from.toISOString().slice(0, 10);
  const toStr = options?.to ?? to.toISOString().slice(0, 10);
  const sessionInventoryPurchases = (await expenseRepo.listExpenses({
    storeId: options?.storeId,
    from: fromStr,
    to: toStr,
    status: "approved",
  }))
    .filter((e) => e.inventory_item_id)
    .reduce((s, e) => s + e.amount, 0);

  return purchaseInvoicesTotal + sessionInventoryPurchases;
}

export async function getProfitReport(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const reportOpts = {
    storeId: options?.storeId,
    days: options?.days ?? 30,
    from: options?.from,
    to: options?.to,
  };
  const sales = await getSalesReport(reportOpts);
  const totalExpenses = await getTotalExpenses(reportOpts);
  const expensesByCenter = await getExpensesByCostCenter(reportOpts);
  const { from, to } = dateRange(options);

  const wasteRecords = await listWasteWithProducts(options?.storeId);
  const wasteInRange = wasteRecords.filter((r) => {
    const d = new Date(r.created_at);
    return d >= from && d <= to;
  });
  const products = await catalogRepo.listProducts();
  const productCostMap = new Map(products.map((p) => [p.id, p.last_unit_cost ?? 0]));
  const wasteCost = wasteInRange.reduce(
    (s, r) => s + r.quantity * (productCostMap.get(r.product_id) ?? 0),
    0
  );

  const orders = (await orderRepo.listOrders(options?.storeId)).filter((o) => {
    const d = new Date(o.created_at);
    return (o.status === "refunded" || o.status === "voided") && d >= from && d <= to;
  });
  const refunds = orders.reduce((s, o) => s + o.total, 0);

  const grossProfit = sales.totalRevenue - sales.totalCost;
  const purchases = await getPurchasesTotal(options);
  const estimatedNetProfit = grossProfit - totalExpenses - wasteCost - refunds;

  return {
    revenue: sales.totalRevenue,
    cogs: sales.totalCost,
    expensesByCostCenter: expensesByCenter,
    totalExpenses,
    purchases,
    wasteCost,
    refunds,
    grossProfit,
    estimatedNetProfit,
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

export async function getProductRankings(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const profitability = await getProductProfitabilityReport(options);
  return {
    highestProfit: profitability.slice(0, 5),
    highestCost: [...profitability].sort((a, b) => b.cost - a.cost).slice(0, 5),
  };
}
