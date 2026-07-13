"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  getReplenishmentReport,
  parseCoverageMonths,
  resolveCalendarMonth,
} from "@/modules/reports/services/replenishment-report.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
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

export async function getReplenishmentReportPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);

  const calendar = resolveCalendarMonth(filters.month);
  const coverageMonths = parseCoverageMonths(filters.coverageMonths);
  const report = await getReplenishmentReport({
    storeId,
    month: calendar.month,
    coverageMonths,
  });

  const [org, stores] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
  ]);

  const context = await buildReportContext(
    {
      ...filters,
      month: calendar.month,
      coverageMonths,
      from: calendar.from.toISOString().slice(0, 10),
      to: calendar.to.toISOString().slice(0, 10),
    },
    user.name,
    storeId
  );

  return {
    filters: { ...filters, month: calendar.month, coverageMonths },
    stores,
    currency: org.currency,
    context,
    report,
  };
}

export async function exportReplenishmentReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getReplenishmentReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Replenishment Report",
    context: data.context,
    fileName: "replenishment-report",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", accessor: (r) => r.metric },
          { header: "Value", accessor: (r) => r.value },
        ],
        rows: [
          { metric: "Month", value: data.report.monthLabel },
          { metric: "Coverage months", value: data.report.coverageMonths },
          { metric: "Orders", value: data.report.orderCount },
          { metric: "SKUs", value: data.report.summary.skuCount },
          { metric: "Need buy", value: data.report.summary.needBuyCount },
        ] as Record<string, unknown>[],
      },
      {
        name: "Buy plan",
        columns: [
          { header: "Product", accessor: (r) => r.productName },
          { header: "SKU", accessor: (r) => r.sku },
          { header: "Unit", accessor: (r) => r.unitLabel },
          { header: "Source", accessor: (r) => r.source },
          { header: "Month usage", accessor: (r) => r.monthUsage },
          { header: "Required", accessor: (r) => r.requiredQty },
          { header: "On hand", accessor: (r) => r.onHand },
          { header: "Suggested buy", accessor: (r) => r.suggestedBuy },
          { header: "Days cover", accessor: (r) => r.daysCover ?? "" },
        ],
        rows: data.report.rows as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-replenishment-${data.report.month}-x${data.report.coverageMonths}.xlsx`,
  };
}
