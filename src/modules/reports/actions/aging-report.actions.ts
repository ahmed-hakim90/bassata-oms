"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getAgingBasicsReport } from "@/modules/reports/services/aging-report.service";
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

export async function getAgingReportPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const [org, stores, report] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getAgingBasicsReport({ storeId }),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return { filters, stores, currency: org.currency, context, report };
}

export async function exportAgingReportExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getAgingReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Aging Report",
    context: data.context,
    fileName: "aging-report",
    sheets: [
      {
        name: "Customer AR",
        columns: [
          { header: "Customer", accessor: (r) => r.name },
          { header: "Balance", accessor: (r) => r.balance },
          { header: "Days", accessor: (r) => r.daysOutstanding },
          { header: "0-30", accessor: (r) => (r.buckets as { current: number }).current },
          { header: "31-60", accessor: (r) => (r.buckets as { days30: number }).days30 },
          { header: "61-90", accessor: (r) => (r.buckets as { days60: number }).days60 },
          { header: "91-120", accessor: (r) => (r.buckets as { days90: number }).days90 },
          { header: "120+", accessor: (r) => (r.buckets as { over90: number }).over90 },
        ],
        rows: data.report.customers.rows as unknown as Record<string, unknown>[],
      },
      {
        name: "Supplier AP",
        columns: [
          { header: "Supplier", accessor: (r) => r.name },
          { header: "Balance", accessor: (r) => r.balance },
          { header: "Days", accessor: (r) => r.daysOutstanding },
          { header: "0-30", accessor: (r) => (r.buckets as { current: number }).current },
          { header: "31-60", accessor: (r) => (r.buckets as { days30: number }).days30 },
          { header: "61-90", accessor: (r) => (r.buckets as { days60: number }).days60 },
          { header: "91-120", accessor: (r) => (r.buckets as { days90: number }).days90 },
          { header: "120+", accessor: (r) => (r.buckets as { over90: number }).over90 },
        ],
        rows: data.report.suppliers.rows as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-aging-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
