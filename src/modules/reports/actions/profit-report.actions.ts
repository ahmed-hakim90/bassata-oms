"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getProfitReport, getProductRankings } from "@/modules/reports/services/profit-report.service";
import { getOutstandingBalances } from "@/modules/customers/services/customer-account.service";
import { listSupplierSummaries } from "@/modules/suppliers/services/supplier.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import {
  requireProfitReportAccess,
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import { buildReportWorkbook, workbookToBase64 } from "@/modules/reports/export/excel-builder";

export async function getProfitReportPageData(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  await requireProfitReportAccess();
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
  const [org, stores, profit, rankings, outstanding, suppliers] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getProfitReport(reportOpts),
    getProductRankings(reportOpts),
    getOutstandingBalances(),
    listSupplierSummaries(storeId ?? activeStoreId),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return {
    filters,
    stores,
    currency: org.currency,
    context,
    profit,
    rankings,
    outstanding,
    supplierBalances: suppliers.filter((s) => s.balanceDue > 0),
    range,
  };
}

export async function exportProfitReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const data = await getProfitReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Profit Report",
    context: data.context,
    fileName: "profit-report",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", accessor: (r) => r.metric },
          { header: "Value", accessor: (r) => r.value },
        ],
        rows: [
          { metric: "Revenue", value: data.profit.revenue },
          { metric: "COGS", value: data.profit.cogs },
          { metric: "Gross profit", value: data.profit.grossProfit },
          { metric: "Expenses", value: data.profit.totalExpenses },
          { metric: "Net profit", value: data.profit.estimatedNetProfit },
          { metric: "Waste cost", value: data.profit.wasteCost },
        ] as Record<string, unknown>[],
      },
      {
        name: "Products",
        columns: [
          { header: "Product", accessor: (r) => r.name },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.rankings.highestProfit.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `CafeFlow-profit-${data.range.days}d.xlsx`,
  };
}
