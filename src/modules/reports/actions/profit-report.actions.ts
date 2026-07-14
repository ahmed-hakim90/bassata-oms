"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  getProfitReport,
  productRankingsFromReport,
} from "@/modules/reports/services/profit-report.service";
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
  const [org, stores, profit, outstanding, suppliers] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    getProfitReport(reportOpts),
    getOutstandingBalances(),
    listSupplierSummaries(storeId ?? activeStoreId),
  ]);
  const rankings = productRankingsFromReport(profit);
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
          { metric: "Avg order profit", value: data.profit.avgOrderProfit },
          {
            metric: "Inventory sell value",
            value: data.profit.inventory.inventorySellValue,
          },
          {
            metric: "Inventory cost value",
            value: data.profit.inventory.inventoryCostValue,
          },
          {
            metric: "Inventory expected profit",
            value: data.profit.inventory.inventoryExpectedProfit,
          },
        ] as Record<string, unknown>[],
      },
      {
        name: "Invoices",
        columns: [
          { header: "Invoice", accessor: (r) => r.orderNumber },
          { header: "Date", accessor: (r) => r.createdAt },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Cost", accessor: (r) => r.cost },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.profit.invoices.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
      {
        name: "Purchases",
        columns: [
          { header: "Invoice", accessor: (r) => r.invoiceNumber },
          { header: "Received", accessor: (r) => r.receivedAt },
          { header: "Purchase cost", accessor: (r) => r.purchaseCost },
          { header: "Expected sell", accessor: (r) => r.expectedSellValue },
          { header: "Expected profit", accessor: (r) => r.expectedProfit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.profit.purchaseInvoices.map((r) => ({ ...r })) as Record<
          string,
          unknown
        >[],
      },
      {
        name: "By Day",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Orders", accessor: (r) => r.orders },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Cost", accessor: (r) => r.cost },
          { header: "Profit", accessor: (r) => r.profit },
          { header: "Margin %", accessor: (r) => r.margin },
        ],
        rows: data.profit.byDay.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
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
        rows: data.profit.products.map((r) => ({ ...r })) as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-profit-${data.range.days}d.xlsx`,
  };
}
