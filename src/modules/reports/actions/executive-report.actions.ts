"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import {
  requireProfitReportAccess,
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import {
  getBranchComparisonReport,
  getCashierPerformanceReport,
  getMarginsRankingReport,
  getPeriodComparisonReport,
  getPnlReport,
  getSalesHeatmapReport,
} from "@/modules/reports/services/executive-analytics.service";

async function resolveExecutiveContext(filters: ReportFilters) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const [org, stores] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return { user, activeStoreId, storeId, range, org, stores, context, filters };
}

export async function getCashiersReportPageData(
  params: Record<string, string | undefined>
) {
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const rows = await getCashierPerformanceReport({
    storeId,
    from: range.from,
    to: range.to,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    rows,
    range,
  };
}

export async function exportCashiersReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getCashiersReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Cashier Performance",
    context: data.context,
    fileName: "cashiers-report",
    sheets: [
      {
        name: "Cashiers",
        columns: [
          { header: "Cashier", accessor: (r) => r.cashierName },
          { header: "Orders", accessor: (r) => r.orderCount },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Avg ticket", accessor: (r) => r.avgTicket },
          { header: "Sessions", accessor: (r) => r.sessionCount },
          { header: "Closed sessions", accessor: (r) => r.closedSessionCount },
          { header: "Variance", accessor: (r) => r.totalVariance },
        ],
        rows: data.rows.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-cashiers-${data.range.days}d.xlsx`,
  };
}

export async function getBranchesReportPageData(
  params: Record<string, string | undefined>
) {
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const rows = await getBranchComparisonReport({
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
    fromDate: range.from,
    toDate: range.to,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    rows,
    range,
  };
}

export async function exportBranchesReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getBranchesReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Branch Comparison",
    context: data.context,
    fileName: "branches-report",
    sheets: [
      {
        name: "Branches",
        columns: [
          { header: "Branch", accessor: (r) => r.storeName },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Cost", accessor: (r) => r.cost },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
          { header: "Orders", accessor: (r) => r.orderCount },
          { header: "Waste cost", accessor: (r) => r.wasteCost },
        ],
        rows: data.rows.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-branches-${data.range.days}d.xlsx`,
  };
}

export async function getPeriodsReportPageData(
  params: Record<string, string | undefined>
) {
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const comparison = await getPeriodComparisonReport({
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
    fromDate: range.from,
    toDate: range.to,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    comparison,
    range,
  };
}

export async function exportPeriodsReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getPeriodsReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Period Comparison",
    context: data.context,
    fileName: "periods-report",
    sheets: [
      {
        name: "Comparison",
        columns: [
          { header: "Metric", accessor: (r) => r.labelAr },
          { header: "Current", accessor: (r) => r.current },
          { header: "Previous", accessor: (r) => r.previous },
          { header: "Delta", accessor: (r) => r.delta },
          { header: "Delta %", accessor: (r) => r.deltaPct ?? "" },
        ],
        rows: data.comparison.metrics.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-periods-${data.range.days}d.xlsx`,
  };
}

export async function getHeatmapReportPageData(
  params: Record<string, string | undefined>
) {
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const modeParam = params.heatmapMode === "day" ? "day" : "weekday";
  const heatmap = await getSalesHeatmapReport({
    storeId,
    from: range.from,
    to: range.to,
    mode: modeParam,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    heatmap,
    range,
  };
}

export async function exportHeatmapReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getHeatmapReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Sales Heatmap",
    context: data.context,
    fileName: "heatmap-report",
    sheets: [
      {
        name: "Heatmap",
        columns: [
          { header: "Axis", accessor: (r) => r.axisLabel },
          { header: "Hour", accessor: (r) => r.hour },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Orders", accessor: (r) => r.orderCount },
        ],
        rows: data.heatmap.cells.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-heatmap-${data.range.days}d.xlsx`,
  };
}

export async function getMarginsReportPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  await requireProfitReportAccess();
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const data = await getMarginsRankingReport({
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    products: data.products,
    categories: data.categories,
    range,
  };
}

export async function exportMarginsReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getMarginsReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Margin Ranking",
    context: data.context,
    fileName: "margins-report",
    sheets: [
      {
        name: "Products",
        columns: [
          { header: "Product", accessor: (r) => r.name },
          { header: "Qty", accessor: (r) => r.quantitySold },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Cost", accessor: (r) => r.cost },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.products.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
      {
        name: "Categories",
        columns: [
          { header: "Category", accessor: (r) => r.categoryName },
          { header: "Qty", accessor: (r) => r.quantitySold },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Cost", accessor: (r) => r.cost },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.categories.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-margins-${data.range.days}d.xlsx`,
  };
}

export async function getPnlReportPageData(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  await requireProfitReportAccess();
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveExecutiveContext(filters);
  const pnl = await getPnlReport({
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
  });
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    lines: pnl.lines,
    estimatedNet: pnl.estimatedNet,
    profit: pnl.profit,
    range,
  };
}

export async function exportPnlReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const data = await getPnlReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "P&L Statement",
    context: data.context,
    fileName: "pnl-report",
    sheets: [
      {
        name: "P&L",
        columns: [
          { header: "Line", accessor: (r) => r.labelAr },
          { header: "Amount", accessor: (r) => r.amount },
        ],
        rows: data.lines.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-pnl-${data.range.days}d.xlsx`,
  };
}
