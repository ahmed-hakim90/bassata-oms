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
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  getProductStockCard,
  productOptionsForStockCard,
} from "@/modules/reports/services/product-stock-card.service";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import {
  parseReportFilters,
  resolveReportDateRange,
  resolveReportStoreId,
} from "@/modules/reports/core/report-filters.schema";
import { requireReportExcelAccess } from "@/modules/reports/actions/report-access.actions";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import { formatUnit } from "@/lib/units";

export async function getProductStockCardPageData(
  params: Record<string, string | undefined>
) {
  await requireFeature("reports");
  const user = await requirePermissionOrRole("inventory_view", [
    "owner",
    "manager",
    "inventory",
  ]);

  const filters = parseReportFilters(params);
  const activeStoreId = await getValidatedActiveStoreId();
  const storeId =
    resolveReportStoreId(activeStoreId, filters.storeId) ?? activeStoreId;
  await requireStoreAccess(storeId);

  const range = resolveReportDateRange(filters);
  const warehouseId =
    filters.warehouseId && filters.warehouseId !== "all"
      ? filters.warehouseId
      : undefined;

  const [org, stores, warehouses, products] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    warehouseRepo.listWarehouses(storeId),
    catalogRepo.listProducts({ activeOnly: true }),
  ]);

  const productOptions = productOptionsForStockCard(products);
  const productId =
    filters.productId && productOptions.some((p) => p.id === filters.productId)
      ? filters.productId
      : undefined;

  const report = productId
    ? await getProductStockCard({
        storeId,
        productId,
        from: range.from,
        to: range.to,
        warehouseId,
      })
    : null;

  const context = await buildReportContext(
    {
      ...filters,
      storeId,
      productId,
      warehouseId,
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
      days: range.days,
    },
    user.name,
    storeId
  );

  return {
    filters: {
      ...filters,
      storeId,
      productId,
      warehouseId,
      from: filters.from ?? range.from.toISOString().slice(0, 10),
      to: filters.to ?? range.to.toISOString().slice(0, 10),
      days: filters.from ? undefined : (filters.days ?? range.days),
    },
    stores,
    warehouses,
    products: productOptions.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      unitLabel: formatUnit(p.unit),
    })),
    currency: org.currency,
    context,
    report,
    rangeDays: range.days,
  };
}

export async function exportProductStockCardExcel(
  params: Record<string, string | undefined>
) {
  await requireReportExcelAccess();
  const data = await getProductStockCardPageData(params);
  if (!data.report) {
    throw new Error("اختر صنفاً أولاً");
  }
  const r = data.report;
  const workbook = buildReportWorkbook({
    title: "Product Stock Card",
    context: data.context,
    fileName: "product-stock-card",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", accessor: (row) => row.metric },
          { header: "Value", accessor: (row) => row.value },
        ],
        rows: [
          { metric: "Product", value: r.product.name },
          { metric: "SKU", value: r.product.sku },
          { metric: "Unit", value: r.product.unitLabel },
          { metric: "Warehouse", value: r.warehouseName ?? "All" },
          { metric: "Opening", value: r.openingQty },
          { metric: "In", value: r.totals.inQty },
          { metric: "Out", value: r.totals.outQty },
          { metric: "Equalize", value: r.totals.equalizeQty },
          { metric: "Closing", value: r.closingQty },
          { metric: "On hand now", value: r.onHandQty },
        ] as Record<string, unknown>[],
      },
      {
        name: "Movements",
        columns: [
          { header: "Date", accessor: (row) => row.at },
          { header: "Type", accessor: (row) => row.movementTypeLabel },
          { header: "Bucket", accessor: (row) => row.bucketLabel },
          { header: "In", accessor: (row) => row.inQty },
          { header: "Out", accessor: (row) => row.outQty },
          { header: "Equalize", accessor: (row) => row.equalizeQty },
          { header: "Balance", accessor: (row) => row.balance },
          { header: "Warehouse", accessor: (row) => row.warehouseName },
          { header: "Reason", accessor: (row) => row.reason ?? "" },
        ],
        rows: r.lines as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-product-card-${r.product.sku || r.product.id}.xlsx`,
  };
}
