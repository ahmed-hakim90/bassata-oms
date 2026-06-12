"use server";

import * as XLSX from "xlsx";
import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import { canViewCosts } from "@/lib/constants";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { getInventoryReport } from "@/modules/reports/services/inventory-report.service";
import { getProductProfitabilityReport } from "@/modules/reports/services/profitability-report.service";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import { getSessionReport } from "@/modules/reports/services/session-report.service";
import {
  getExpensesByCostCenter,
  getExpensesByCategory,
  getExpensesByCategoryWithTrend,
  getExpensesByStore,
  getSessionExpensesReport,
  getTopExpenses,
} from "@/modules/reports/services/expense-report.service";
import { getOutstandingBalances, getAgingReport } from "@/modules/customers/services/customer-account.service";
import {
  getProfitReport,
  getHighestWasteReport,
  getProductRankings,
} from "@/modules/reports/services/profit-report.service";

function resolveReportStoreId(
  activeStoreId: string,
  filterStoreId?: string | null
): string | undefined {
  if (!filterStoreId || filterStoreId === "all") return undefined;
  return filterStoreId;
}

export async function getReportsData(
  days = 30,
  filterStoreId?: string | null,
  range?: { from?: string; to?: string }
) {
  await requireFeature("reports");
  const user = await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const permissions = await getEffectivePermissions(user);
  const activeStoreId = await getValidatedActiveStoreId();
  const reportStoreId = resolveReportStoreId(activeStoreId, filterStoreId);
  if (reportStoreId) {
    await requireStoreAccess(reportStoreId);
  }
  const inventoryStoreId = reportStoreId ?? activeStoreId;
  const org = await orgRepo.getOrganization();
  const stores = await storeRepo.listStores();
  const reportOpts = {
    storeId: reportStoreId,
    days,
    from: range?.from,
    to: range?.to,
  };
  const showCosts = canViewCosts(user.role, permissions);
  let customerAccounts = null;
  if (permissions.has("customer_ledger_view") || user.role === "owner") {
    try {
      customerAccounts = {
        outstanding: await getOutstandingBalances(),
        aging: await getAgingReport(),
      };
    } catch {
      customerAccounts = null;
    }
  }
  let accounting = null;
  if (showCosts) {
    try {
      await requirePermissionOrRole("expense_view_all", ["owner", "manager"]);
      accounting = {
        profit: await getProfitReport(reportOpts),
        expensesByCenter: await getExpensesByCostCenter(reportOpts),
        expensesByStore: await getExpensesByStore(reportOpts),
        expensesByCategory: await getExpensesByCategory(reportOpts),
        expensesByCategoryTrend: await getExpensesByCategoryWithTrend(reportOpts),
        sessionExpenses: await getSessionExpensesReport(reportOpts),
        topExpenses: await getTopExpenses(reportOpts),
        highestWaste: await getHighestWasteReport(reportStoreId, days),
        productRankings: await getProductRankings(reportOpts),
      };
    } catch {
      accounting = null;
    }
  }
  return {
    activeStoreId,
    filterStoreId: filterStoreId ?? "all",
    from: range?.from ?? null,
    to: range?.to ?? null,
    stores,
    currency: org.currency,
    showCosts,
    sales: await getSalesReport(reportOpts),
    profitability: showCosts
      ? await getProductProfitabilityReport(reportOpts)
      : [],
    inventory: await getInventoryReport(inventoryStoreId),
    sessions: await getSessionReport(inventoryStoreId, days),
    accounting,
    customerAccounts,
  };
}

export async function exportReportsAction(
  days = 30,
  filterStoreId?: string | null,
  range?: { from?: string; to?: string }
) {
  await requireFeature("reports");
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const data = await getReportsData(days, filterStoreId, range);
  const rows: Record<string, string | number>[] = [
    { metric: "Total Revenue", value: data.sales.totalRevenue },
    { metric: "Orders", value: data.sales.orderCount },
    { metric: "Avg Order Value", value: data.sales.avgOrderValue },
  ];
  if (data.showCosts) {
    rows.push(
      { metric: "Total COGS", value: data.sales.totalCost },
      { metric: "Gross Profit", value: data.sales.grossProfit },
      { metric: "Avg Margin %", value: data.sales.avgMargin }
    );
  }
  const summarySheet = XLSX.utils.json_to_sheet([
    ...rows,
    ...data.sales.topProducts.map((p) => ({
      metric: `Product: ${p.name}`,
      value: p.revenue,
      quantity: p.quantity,
      ...(data.showCosts
        ? { cost: p.cost, profit: p.profit, margin: p.margin }
        : {}),
    })),
    ...data.sales.revenueByStore.map((s) => ({
      metric: `Store: ${s.storeName}`,
      value: s.revenue,
    })),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  if (data.accounting) {
    const acc = data.accounting;
    const accountingRows: Record<string, string | number>[] = [
      { metric: "Revenue", value: acc.profit.revenue },
      { metric: "COGS", value: acc.profit.cogs },
      { metric: "Gross Profit", value: acc.profit.grossProfit },
      { metric: "Total Expenses", value: acc.profit.totalExpenses },
      { metric: "Waste Cost", value: acc.profit.wasteCost },
      { metric: "Refunds", value: acc.profit.refunds },
      { metric: "Purchases", value: acc.profit.purchases },
      { metric: "Est. Net Profit", value: acc.profit.estimatedNetProfit },
      ...acc.expensesByCenter.map((c) => ({
        metric: `Center: ${c.name}`,
        value: c.amount,
      })),
      ...acc.expensesByCategory.map((c) => ({
        metric: `Category: ${c.name}`,
        value: c.amount,
      })),
      ...acc.sessionExpenses.map((s) => ({
        metric: `Session: ${s.cashierName}`,
        value: s.total,
        items: s.expenses.length,
      })),
    ];
    if (acc.topExpenses.highestSingle) {
      accountingRows.push({
        metric: `Top expense: ${acc.topExpenses.highestSingle.title}`,
        value: acc.topExpenses.highestSingle.amount,
      });
    }
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(accountingRows),
      "Accounting"
    );
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return {
    filename: `CafeFlow-reports-${days}d.xlsx`,
    base64: Buffer.from(buffer).toString("base64"),
  };
}
