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
import * as orderRepo from "@/lib/repositories/order.repository";
import { getSalesReport } from "@/modules/reports/services/sales-report.service";
import {
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
  type ReportFilters,
} from "@/modules/reports/core/report-filters.schema";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";

async function resolveSalesContext(filters: ReportFilters) {
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

export async function getSalesReportPageData(params: Record<string, string | undefined>) {
  const filters = parseReportFilters(params);
  const { storeId, range, org, stores, context } = await resolveSalesContext(filters);

  let summary = null;
  let revenueByDay: { date: string; revenue: number; orders: number }[] = [];
  try {
    summary = await reportRepo.getSalesSummaryRpc({
      storeId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      paymentMethod: filters.paymentMethod,
    });
    revenueByDay = await reportRepo.getSalesByDayRpc({
      storeId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
  } catch {
    const legacy = await getSalesReport({
      storeId,
      days: range.days,
      from: filters.from,
      to: filters.to,
    });
    summary = {
      totalRevenue: legacy.totalRevenue,
      orderCount: legacy.orderCount,
      avgOrderValue: legacy.avgOrderValue,
    };
    revenueByDay = legacy.revenueByDay.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      orders: d.orders,
    }));
  }

  const orders = (await orderRepo.listOrders(storeId))
    .filter((o) => o.status === "completed")
    .filter((o) => {
      const created = new Date(o.created_at);
      return created >= range.from && created <= range.to;
    })
    .slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);

  return {
    filters,
    stores,
    currency: org.currency,
    context,
    summary,
    revenueByDay,
    orders,
    totalOrders: summary.orderCount,
  };
}

export async function exportSalesReportExcel(params: Record<string, string | undefined>) {
  await requireReportExcelAccess();
  const filters = parseReportFilters(params);
  const { storeId, range, context } = await resolveSalesContext(filters);
  const data = await getSalesReport({
    storeId,
    days: range.days,
    from: filters.from,
    to: filters.to,
  });

  const workbook = buildReportWorkbook({
    title: "Sales Report",
    context,
    fileName: "sales-report",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", accessor: (r) => r.metric },
          { header: "Value", accessor: (r) => r.value },
        ],
        rows: [
          { metric: "Total revenue", value: data.totalRevenue },
          { metric: "Orders", value: data.orderCount },
          { metric: "Average order", value: data.avgOrderValue },
        ] as Record<string, unknown>[],
      },
      {
        name: "Top Products",
        columns: [
          { header: "Product", accessor: (r) => r.name },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Revenue", accessor: (r) => r.revenue },
        ],
        rows: data.topProducts as Record<string, unknown>[],
      },
    ],
  });

  return {
    base64: workbookToBase64(workbook),
    filename: `CafeFlow-sales-${range.days}d.xlsx`,
  };
}
