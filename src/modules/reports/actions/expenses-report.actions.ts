"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  getExpensesByCategory,
  getExpensesByCostCenter,
  getTopExpenses,
  getTotalExpenses,
} from "@/modules/reports/services/expense-report.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import {
  requireFinancialReportAccess,
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import { buildReportWorkbook, workbookToBase64 } from "@/modules/reports/export/excel-builder";

export async function getExpensesReportPageData(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  await requireFinancialReportAccess();
  const user = await requireReportsView();
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const reportOpts = {
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
  };
  const [org, stores, total, byCenter, byCategory, topExpenses] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getTotalExpenses(reportOpts),
    getExpensesByCostCenter(reportOpts),
    getExpensesByCategory(reportOpts),
    getTopExpenses(reportOpts),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    total,
    byCenter,
    byCategory,
    topExpenses,
    range,
  };
}

export async function exportExpensesReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const data = await getExpensesReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Expenses Report",
    context: data.context,
    fileName: "expenses-report",
    sheets: [
      {
        name: "By cost center",
        columns: [
          { header: "Cost center", accessor: (r) => r.name },
          { header: "Amount", accessor: (r) => r.amount },
        ],
        rows: data.byCenter as Record<string, unknown>[],
      },
      {
        name: "By category",
        columns: [
          { header: "Category", accessor: (r) => r.name },
          { header: "Amount", accessor: (r) => r.amount },
        ],
        rows: data.byCategory as Record<string, unknown>[],
      },
      {
        name: "Top expenses",
        columns: [
          { header: "Description", accessor: (r) => r.description },
          { header: "Amount", accessor: (r) => r.amount },
          { header: "Date", accessor: (r) => r.date },
        ],
        rows: (data.topExpenses.highestSingle
          ? [
              {
                description: data.topExpenses.highestSingle.title,
                amount: data.topExpenses.highestSingle.amount,
                date: data.topExpenses.highestSingle.created_at,
              },
            ]
          : []) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-expenses-${data.range.days}d.xlsx`,
  };
}
