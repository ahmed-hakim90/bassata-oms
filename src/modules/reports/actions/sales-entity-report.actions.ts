"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import {
  requireReportExcelAccess,
  requireReportsView,
} from "@/modules/reports/actions/report-access.actions";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  getBranchSalesMiniReport,
  getCashierSalesMiniReport,
  getProductSalesMiniReport,
} from "@/modules/reports/services/sales-entity-report.service";

async function resolveEntityContext(params: Record<string, string | undefined>) {
  await requireFeature("reports");
  const user = await requireReportsView();
  await requirePermissionOrRole("reports_view", ["owner", "manager"]);
  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = resolveReportStoreId(activeStoreId, filters.storeId);
  if (storeId) await requireStoreAccess(storeId);
  const range = resolveReportDateRange(filters);
  const [org, stores] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
  ]);
  const context = await buildReportContext(
    {
      ...filters,
      from: filters.from ?? range.from.toISOString().slice(0, 10),
      to: filters.to ?? range.to.toISOString().slice(0, 10),
    },
    user.name,
    storeId
  );
  return {
    filters: {
      ...filters,
      from: filters.from ?? range.from.toISOString().slice(0, 10),
      to: filters.to ?? range.to.toISOString().slice(0, 10),
      days: filters.from ? undefined : (filters.days ?? range.days),
    },
    storeId,
    range,
    org,
    stores,
    context,
  };
}

export async function getProductSalesMiniPageData(
  params: Record<string, string | undefined>
) {
  const { filters, storeId, range, org, stores, context } =
    await resolveEntityContext(params);
  const products = (await catalogRepo.listProducts({ activeOnly: true })).map(
    (p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
    })
  );
  const productId =
    filters.productId && products.some((p) => p.id === filters.productId)
      ? filters.productId
      : undefined;
  const report = productId
    ? await getProductSalesMiniReport({
        productId,
        storeId,
        from: range.from,
        to: range.to,
      })
    : null;

  return {
    filters: { ...filters, productId },
    stores,
    products,
    currency: org.currency,
    context,
    report,
  };
}

export async function getBranchSalesMiniPageData(
  params: Record<string, string | undefined>
) {
  const { filters, storeId, range, org, stores, context } =
    await resolveEntityContext(params);
  const resolvedStoreId =
    storeId && stores.some((s) => s.id === storeId)
      ? storeId
      : stores[0]?.id;
  const report = resolvedStoreId
    ? await getBranchSalesMiniReport({
        storeId: resolvedStoreId,
        from: range.from,
        to: range.to,
        fromIso: filters.from,
        toIso: filters.to,
        days: range.days,
      })
    : null;

  return {
    filters: { ...filters, storeId: resolvedStoreId },
    stores,
    currency: org.currency,
    context,
    report,
  };
}

export async function getCashierSalesMiniPageData(
  params: Record<string, string | undefined>
) {
  const { filters, storeId, range, org, stores, context } =
    await resolveEntityContext(params);
  const users = await userRepo.listUsers();
  const cashiers = users
    .filter((u) => u.role === "cashier" || u.role === "manager" || u.role === "owner")
    .map((u) => ({ id: u.id, name: u.name, role: u.role }));
  const cashierId =
    filters.cashierId && cashiers.some((c) => c.id === filters.cashierId)
      ? filters.cashierId
      : undefined;
  const report = cashierId
    ? await getCashierSalesMiniReport({
        cashierId,
        storeId,
        from: range.from,
        to: range.to,
      })
    : null;

  return {
    filters: { ...filters, cashierId },
    stores,
    cashiers,
    currency: org.currency,
    context,
    report,
  };
}

export async function exportProductSalesMiniExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getProductSalesMiniPageData(params);
  if (!data.report) throw new Error("اختار منتج أولًا");
  const workbook = buildReportWorkbook({
    title: "مبيعات منتج",
    context: data.context,
    fileName: "product-sales",
    sheets: [
      {
        name: "By day",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Orders", accessor: (r) => r.orders },
        ],
        rows: data.report.revenueByDay as unknown as Record<string, unknown>[],
      },
      {
        name: "By store",
        columns: [
          { header: "Store", accessor: (r) => r.storeName },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Revenue", accessor: (r) => r.revenue },
        ],
        rows: data.report.byStore as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-product-sales-${data.report.productName.replace(/\s+/g, "-")}.xlsx`,
  };
}

export async function exportBranchSalesMiniExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getBranchSalesMiniPageData(params);
  if (!data.report) throw new Error("اختار فرع أولًا");
  const workbook = buildReportWorkbook({
    title: "ملخص فرع",
    context: data.context,
    fileName: "branch-sales",
    sheets: [
      {
        name: "Top products",
        columns: [
          { header: "Product", accessor: (r) => r.name },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Revenue", accessor: (r) => r.revenue },
        ],
        rows: data.report.topProducts as unknown as Record<string, unknown>[],
      },
      {
        name: "Cashiers",
        columns: [
          { header: "Cashier", accessor: (r) => r.cashierName },
          { header: "Orders", accessor: (r) => r.orderCount },
          { header: "Revenue", accessor: (r) => r.revenue },
        ],
        rows: data.report.cashiers as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-branch-${data.report.storeName.replace(/\s+/g, "-")}.xlsx`,
  };
}

export async function exportCashierSalesMiniExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getCashierSalesMiniPageData(params);
  if (!data.report) throw new Error("اختار موظف أولًا");
  const workbook = buildReportWorkbook({
    title: "ملخص موظف",
    context: data.context,
    fileName: "cashier-sales",
    sheets: [
      {
        name: "Top products",
        columns: [
          { header: "Product", accessor: (r) => r.name },
          { header: "Qty", accessor: (r) => r.quantity },
          { header: "Revenue", accessor: (r) => r.revenue },
        ],
        rows: data.report.topProducts as unknown as Record<string, unknown>[],
      },
      {
        name: "By day",
        columns: [
          { header: "Date", accessor: (r) => r.date },
          { header: "Revenue", accessor: (r) => r.revenue },
          { header: "Orders", accessor: (r) => r.orders },
        ],
        rows: data.report.revenueByDay as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-cashier-${data.report.cashierName.replace(/\s+/g, "-")}.xlsx`,
  };
}
