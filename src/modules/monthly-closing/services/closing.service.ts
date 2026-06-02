import * as closingRepo from "@/lib/repositories/closing.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getInventoryReport } from "@/modules/reports/services/inventory-report.service";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import { getSessionReport } from "@/modules/reports/services/session-report.service";
import { getProfitReport, getHighestWasteReport, getProductRankings } from "@/modules/reports/services/profit-report.service";
import { getExpensesByCostCenter, getExpensesByCategory } from "@/modules/reports/services/expense-report.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import type { MonthlyClose } from "@/lib/types";

export async function listClosings(): Promise<MonthlyClose[]> {
  return closingRepo.listClosings();
}

export async function getClosing(id: string): Promise<MonthlyClose | null> {
  return closingRepo.getClosing(id);
}

async function buildSummary(input: {
  storeId: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  end.setHours(23, 59, 59, 999);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const sales = await getSalesReport({
    storeId: input.storeId ?? undefined,
    days: Math.max(days, 1),
  });
  const inventory = await getInventoryReport(input.storeId ?? undefined);
  const sessions = await getSessionReport(input.storeId ?? undefined, days);

  const orders = (await orderRepo.listOrders(input.storeId ?? undefined)).filter((o) => {
    const d = new Date(o.created_at);
    return o.status === "completed" && d >= start && d <= end;
  });

  const reportOpts = {
    storeId: input.storeId ?? undefined,
    from: input.periodStart,
    to: input.periodEnd,
  };
  const profit = await getProfitReport(reportOpts);
  const expensesByCostCenter = await getExpensesByCostCenter(reportOpts);
  const expensesByCategory = await getExpensesByCategory(reportOpts);
  const highestWaste = await getHighestWasteReport(input.storeId ?? undefined, days);
  const productRankings = await getProductRankings(reportOpts);

  return {
    totalRevenue: orders.reduce((s, o) => s + o.total, 0),
    orderCount: orders.length,
    avgOrderValue:
      orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0,
    inventoryValuation: inventory.valuationEstimate,
    lowStockCount: inventory.lowStockCount,
    sessionVariance: sessions.totalVariance,
    closedSessions: sessions.closedSessions,
    salesKpi: sales,
    cogs: profit.cogs,
    expensesByCostCenter,
    expensesByCategory,
    totalExpenses: profit.totalExpenses,
    wasteCost: profit.wasteCost,
    purchases: profit.purchases,
    refunds: profit.refunds,
    grossProfit: profit.grossProfit,
    estimatedNetProfit: profit.estimatedNetProfit,
    topExpenseCategory: expensesByCategory[0] ?? null,
    topWasteItem: highestWaste[0] ?? null,
    topProfitProduct: productRankings.highestProfit[0] ?? null,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateSnapshot(input: {
  storeId: string | null;
  periodStart: string;
  periodEnd: string;
  userId: string;
}): Promise<MonthlyClose> {
  const orgId = await getOrgId();
  const summary = await buildSummary(input);
  const closing = await closingRepo.createClosing({
    org_id: orgId,
    store_id: input.storeId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    status: "draft",
    summary,
  });

  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.userId,
    action: "monthly_close.draft_created",
    entityType: "monthly_close",
    entityId: closing.id,
  });

  return closing;
}

export async function closePeriod(
  closingId: string,
  userId: string
): Promise<MonthlyClose> {
  const closing = await closingRepo.getClosing(closingId);
  if (!closing) throw new Error("Closing not found");
  if (closing.status === "closed") throw new Error("Period already closed");

  const summary = await buildSummary({
    storeId: closing.store_id,
    periodStart: closing.period_start,
    periodEnd: closing.period_end,
  });

  const updated = await closingRepo.updateClosing(closingId, {
    status: "closed",
    summary,
    closed_by: userId,
    closed_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("Failed to close period");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: closing.store_id,
    userId,
    action: "monthly_close.completed",
    entityType: "monthly_close",
    entityId: closingId,
    metadata: { period: `${closing.period_start} – ${closing.period_end}` },
  });

  return updated;
}

export async function reopenPeriod(
  closingId: string,
  userId: string
): Promise<MonthlyClose> {
  const closing = await closingRepo.getClosing(closingId);
  if (!closing) throw new Error("Closing not found");
  if (closing.status !== "closed") throw new Error("Only closed periods can be reopened");

  const updated = await closingRepo.updateClosing(closingId, {
    status: "reopened",
  });
  if (!updated) throw new Error("Failed to reopen period");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: closing.store_id,
    userId,
    action: "monthly_close.reopened",
    entityType: "monthly_close",
    entityId: closingId,
  });

  return updated;
}
