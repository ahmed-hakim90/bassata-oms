"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getTaxReport } from "@/modules/reports/services/tax-report.service";
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

export async function getTaxReportPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const [org, stores, report] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getTaxReport({ storeId, from: range.from, to: range.to }),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return { filters, stores, currency: org.currency, context, report, range };
}

export async function exportTaxReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getTaxReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Tax Report",
    context: data.context,
    fileName: "tax-report",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", accessor: (r) => r.metric },
          { header: "Value", accessor: (r) => r.value },
        ],
        rows: [
          { metric: "Tax rate", value: data.report.taxRate },
          { metric: "Tax inclusive", value: data.report.taxInclusive ? "yes" : "no" },
          { metric: "Orders", value: data.report.summary.orderCount },
          { metric: "Taxable base", value: data.report.summary.taxableBase },
          { metric: "Tax collected", value: data.report.summary.taxCollected },
          { metric: "Gross sales", value: data.report.summary.grossSales },
        ] as Record<string, unknown>[],
      },
      {
        name: "By Day",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Orders", accessor: (r) => r.orderCount },
          { header: "Taxable base", accessor: (r) => r.taxableBase },
          { header: "Tax", accessor: (r) => r.tax },
          { header: "Total", accessor: (r) => r.total },
        ],
        rows: data.report.byDay as unknown as Record<string, unknown>[],
      },
      {
        name: "Orders",
        columns: [
          { header: "Order", accessor: (r) => r.orderNumber },
          { header: "Store", accessor: (r) => r.storeName },
          { header: "Created", accessor: (r) => r.createdAt },
          { header: "Subtotal", accessor: (r) => r.subtotal },
          { header: "Discount", accessor: (r) => r.discount },
          { header: "Tax", accessor: (r) => r.tax },
          { header: "Total", accessor: (r) => r.total },
        ],
        rows: data.report.orders as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-tax-${data.range.days}d.xlsx`,
  };
}
