"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as reportRepo from "@/lib/repositories/report.repository";
import { getInventoryReport } from "@/modules/reports/services/inventory-report.service";
import { getHighestWasteReport } from "@/modules/reports/services/profit-report.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import { requireReportExcelAccess, requireReportsView } from "@/modules/reports/actions/report-access.actions";
import { buildReportWorkbook, workbookToBase64 } from "@/modules/reports/export/excel-builder";

export async function getInventoryReportPageData(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("inventory_view", ["owner", "manager", "inventory"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId) ?? activeStoreId;
  await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);

  const [org, stores, kpi, waste] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getInventoryReport(storeId),
    getHighestWasteReport(storeId, range.days),
  ]);

  let valuation: Awaited<ReturnType<typeof reportRepo.getInventoryValuationRpc>> = [];
  let expiryBatches: Awaited<ReturnType<typeof reportRepo.getExpiryBatchesRpc>> = [];
  let nearExpiry: Awaited<ReturnType<typeof reportRepo.getExpiryBatchesRpc>> = [];
  let expired: Awaited<ReturnType<typeof reportRepo.getExpiryBatchesRpc>> = [];

  try {
    [valuation, nearExpiry, expired] = await Promise.all([
      reportRepo.getInventoryValuationRpc(storeId),
      reportRepo.getExpiryBatchesRpc(storeId, "near"),
      reportRepo.getExpiryBatchesRpc(storeId, "expired"),
    ]);
    expiryBatches = [...nearExpiry, ...expired];
  } catch {
    expiryBatches = [];
  }

  const context = await buildReportContext(filters, user.name, storeId);
  const expiredValue = expired.reduce((s: number, b) => s + b.remainingQuantity, 0);

  return {
    filters,
    stores,
    currency: org.currency,
    context,
    kpi,
    valuation,
    expiryBatches,
    nearExpiry,
    expired,
    expiredValue,
    waste,
    range,
  };
}

export async function exportInventoryReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const data = await getInventoryReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Inventory Report",
    context: data.context,
    fileName: "inventory-report",
    sheets: [
      {
        name: "Valuation",
        columns: [
          { header: "Product", accessor: (r) => r.productName },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Unit cost", accessor: (r) => r.unitCost },
          { header: "Value", accessor: (r) => r.totalValue },
        ],
        rows: data.valuation as Record<string, unknown>[],
      },
      {
        name: "Expiry",
        columns: [
          { header: "Product", accessor: (r) => r.productName },
          { header: "Batch", accessor: (r) => r.batchNumber },
          { header: "Expiry", accessor: (r) => r.expiryDate },
          { header: "Qty", accessor: (r) => r.remainingQuantity },
          { header: "Days", accessor: (r) => r.daysUntilExpiry },
        ],
        rows: data.expiryBatches as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: "Velora-inventory.xlsx",
  };
}
