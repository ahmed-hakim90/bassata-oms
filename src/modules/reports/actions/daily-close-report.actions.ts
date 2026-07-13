"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getDailyCloseReport } from "@/modules/reports/services/daily-close-report.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import {
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";

function defaultToTodayIfUnset(params: Record<string, string | undefined>) {
  if (params.from || params.to || params.days) return params;
  const today = new Date().toISOString().slice(0, 10);
  return { ...params, from: today, to: today };
}

export async function getDailyCloseReportPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(defaultToTodayIfUnset(params));
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const [org, stores, report] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getDailyCloseReport({ storeId, from: range.from, to: range.to }),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return { filters, stores, currency: org.currency, context, report, range };
}

export async function exportDailyCloseReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getDailyCloseReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Daily Close Report",
    context: data.context,
    fileName: "daily-close-report",
    sheets: [
      {
        name: "Totals",
        columns: [
          { header: "Metric", accessor: (r) => r.metric },
          { header: "Value", accessor: (r) => r.value },
        ],
        rows: [
          { metric: "Closed sessions", value: data.report.closedCount },
          { metric: "Open sessions", value: data.report.openCount },
          { metric: "Opening cash", value: data.report.totals.openingCash },
          { metric: "Cash sales", value: data.report.totals.cashSales },
          { metric: "Card sales", value: data.report.totals.cardSales },
          { metric: "Wallet sales", value: data.report.totals.walletSales },
          { metric: "Credit sales", value: data.report.totals.creditSales },
          { metric: "Cash refunds", value: data.report.totals.cashRefunds },
          { metric: "Expenses", value: data.report.totals.expenses },
          { metric: "Expected cash", value: data.report.totals.expectedCash },
          { metric: "Actual cash", value: data.report.totals.actualCash },
          { metric: "Variance", value: data.report.totals.variance },
        ] as Record<string, unknown>[],
      },
      {
        name: "Sessions",
        columns: [
          { header: "Cashier", accessor: (r) => r.cashierName },
          { header: "Store", accessor: (r) => r.storeName },
          { header: "Opened", accessor: (r) => r.openedAt },
          { header: "Closed", accessor: (r) => r.closedAt ?? "" },
          { header: "Expected", accessor: (r) => r.expectedCash },
          { header: "Actual", accessor: (r) => r.actualCash ?? "" },
          { header: "Variance", accessor: (r) => r.variance ?? "" },
        ],
        rows: data.report.sessions as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-daily-close-${data.report.businessDay}.xlsx`,
  };
}
