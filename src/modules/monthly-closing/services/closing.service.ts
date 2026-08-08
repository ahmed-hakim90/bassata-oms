import * as closingRepo from "@/lib/repositories/closing.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getInventoryReport } from "@/modules/reports/services/inventory-report.service";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import { getSessionReport } from "@/modules/reports/services/session-report.service";
import {
  getProfitReport,
  getHighestWasteReport,
  getProductRankings,
} from "@/modules/reports/services/profit-report.service";
import {
  getExpensesByCostCenter,
  getExpensesByCategory,
} from "@/modules/reports/services/expense-report.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import { orderBusinessAt } from "@/lib/document-date";
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
  const end = new Date(`${input.periodEnd}T23:59:59`);
  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );

  const reportOpts = {
    storeId: input.storeId ?? undefined,
    from: input.periodStart,
    to: input.periodEnd,
    days,
  };

  const [sales, inventory, sessions, profit, expensesByCostCenter, expensesByCategory, highestWaste, productRankings] =
    await Promise.all([
      getSalesReport(reportOpts),
      getInventoryReport(input.storeId ?? undefined),
      getSessionReport(input.storeId ?? undefined, days),
      getProfitReport(reportOpts),
      getExpensesByCostCenter(reportOpts),
      getExpensesByCategory(reportOpts),
      getHighestWasteReport(input.storeId ?? undefined, days),
      getProductRankings(reportOpts),
    ]);

  const orders = (await orderRepo.listOrders(input.storeId ?? undefined)).filter((o) => {
    const d = new Date(orderBusinessAt(o));
    return o.status === "completed" && d >= start && d <= end;
  });

  return {
    totalRevenue: orders.reduce((s, o) => s + o.total, 0),
    orderCount: orders.length,
    avgOrderValue:
      orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0,
    inventoryValuation: inventory.valuationEstimate,
    lowStockCount: inventory.lowStockCount,
    sessionVariance: sessions.totalVariance,
    closedSessions: sessions.closedSessions,
    salesKpi: {
      totalRevenue: sales.totalRevenue,
      orderCount: sales.orderCount,
      avgOrderValue: sales.avgOrderValue,
    },
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
  if (!input.periodStart || !input.periodEnd) {
    throw new Error("حدد بداية ونهاية الفترة");
  }
  if (input.periodEnd < input.periodStart) {
    throw new Error("نهاية الفترة لازم تكون بعد البداية");
  }

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
  if (!closing) throw new Error("الإقفال مش موجود");
  if (closing.status === "closed") throw new Error("الفترة مقفولة بالفعل");

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
  if (!updated) throw new Error("فشل إقفال الفترة");

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
  if (!closing) throw new Error("الإقفال مش موجود");
  if (closing.status !== "closed") throw new Error("ينفع تعيد فتح الفترات المقفولة فقط");

  const updated = await closingRepo.updateClosing(closingId, {
    status: "reopened",
  });
  if (!updated) throw new Error("فشل إعادة فتح الفترة");

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
