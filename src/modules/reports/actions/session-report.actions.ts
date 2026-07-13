"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import { requireAuth } from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as reportRepo from "@/lib/repositories/report.repository";
import { getSessionReport } from "@/modules/reports/services/session-report.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import { requireReportExcelAccess, requireReportsView } from "@/modules/reports/actions/report-access.actions";
import { buildReportWorkbook, workbookToBase64 } from "@/modules/reports/export/excel-builder";

export async function getSessionsReportPageData(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const [org, stores, kpi] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getSessionReport(storeId, range.days),
  ]);
  const context = await buildReportContext(filters, user.name, storeId);
  return { filters, stores, currency: org.currency, context, kpi, range };
}

export async function getSessionClosingData(sessionId: string) {
  await requireFeature("reports");
  const user = await requireAuth();
  await requirePermissionOrRole("session_view", ["owner", "manager", "cashier"]);
  const session = await sessionRepo.getSession(sessionId);
  if (!session) throw new Error("Session not found");
  await requireStoreAccess(session.store_id);

  let reconciliation;
  try {
    reconciliation = await reportRepo.getSessionReconciliationRpc(sessionId);
  } catch {
    const { calcExpectedCash } = await import(
      "@/modules/sessions/services/reconciliation.service"
    );
    const legacy = await calcExpectedCash(sessionId);
    reconciliation = {
      openingCash: legacy.openingCash,
      cashSales: legacy.cashSales,
      cardSales: 0,
      walletSales: 0,
      creditSales: 0,
      cashRefunds: legacy.cashRefunds,
      expenses: legacy.expenses,
      customerPayments: 0,
      expectedCash: legacy.expectedCash,
    };
  }

  const users = await userRepo.listUsers();
  const stores = await storeRepo.listStores();
  const org = await orgRepo.getOrganization();
  const cashier = users.find((u) => u.id === session.cashier_id);
  const store = stores.find((s) => s.id === session.store_id);

  return {
    session,
    reconciliation,
    variance: session.variance,
    actualCash: session.actual_cash,
    currency: org.currency,
    cashierName: cashier?.name ?? "—",
    storeName: store?.name ?? "—",
    generatedBy: user.name,
    generatedAt: new Date().toISOString(),
    org,
  };
}

export async function exportSessionsReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const data = await getSessionsReportPageData(params);
  const workbook = buildReportWorkbook({
    title: "Sessions Report",
    context: data.context,
    fileName: "sessions-report",
    sheets: [
      {
        name: "Sessions",
        columns: [
          { header: "Cashier", accessor: (r) => r.cashierName },
          { header: "Store", accessor: (r) => r.storeName },
          { header: "Opened", accessor: (r) => r.openedAt },
          { header: "Closed", accessor: (r) => r.closedAt ?? "" },
          { header: "Variance", accessor: (r) => r.variance ?? 0 },
          { header: "Status", accessor: (r) => r.status },
        ],
        rows: data.kpi.recentSessions as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-sessions-${data.range.days}d.xlsx`,
  };
}
