import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import type { PlatformOrganizationSummary } from "@/modules/platform/services/platform-org.service";
import { listOrganizationHealthSummaries } from "@/modules/platform/services/platform-org.service";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildPlatformOrganizationsWorkbook(
  summaries: PlatformOrganizationSummary[]
): { base64: string; fileName: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `platform-organizations-${stamp}.xlsx`;

  const rows = summaries.map((org) => ({
    name: org.name,
    status: org.status === "suspended" ? "معلّقة" : "نشطة",
    currency: org.currency,
    country: org.country,
    created_at: org.created_at,
    stores: org.health.storeCount,
    users: org.health.userCount,
    devices: org.health.deviceCount,
    products: org.health.productCount,
    customers: org.health.customerCount,
    orders: org.health.orderCount,
    expenses: org.health.expenseCount,
    purchases: org.health.purchaseCount,
    movements: org.health.inventoryMovementCount,
    last_order_at: org.health.lastOrderAt ?? "",
    approx_size: formatBytes(org.health.databaseBytes),
    org_id: org.id,
  }));

  const workbook = buildReportWorkbook({
    title: "تقرير شركات المنصة",
    fileName,
    sheets: [
      {
        name: "Companies",
        rows,
        columns: [
          { header: "الشركة", accessor: (r) => r.name, width: 28 },
          { header: "الحالة", accessor: (r) => r.status, width: 12 },
          { header: "العملة", accessor: (r) => r.currency, width: 10 },
          { header: "الدولة", accessor: (r) => r.country, width: 10 },
          { header: "تاريخ الإنشاء", accessor: (r) => r.created_at, width: 22 },
          { header: "فروع", accessor: (r) => r.stores, width: 8 },
          { header: "مستخدمين", accessor: (r) => r.users, width: 10 },
          { header: "أجهزة", accessor: (r) => r.devices, width: 8 },
          { header: "منتجات", accessor: (r) => r.products, width: 10 },
          { header: "عملاء", accessor: (r) => r.customers, width: 8 },
          { header: "طلبات", accessor: (r) => r.orders, width: 10 },
          { header: "مصروفات", accessor: (r) => r.expenses, width: 10 },
          { header: "مشتريات", accessor: (r) => r.purchases, width: 10 },
          { header: "حركات مخزون", accessor: (r) => r.movements, width: 12 },
          { header: "آخر طلب", accessor: (r) => r.last_order_at, width: 22 },
          { header: "حجم تقريبي", accessor: (r) => r.approx_size, width: 12 },
          { header: "معرّف الشركة", accessor: (r) => r.org_id, width: 36 },
        ],
      },
    ],
  });

  return { base64: workbookToBase64(workbook), fileName };
}

export async function exportPlatformOrganizationsReport(): Promise<{
  base64: string;
  fileName: string;
}> {
  const summaries = await listOrganizationHealthSummaries();
  return buildPlatformOrganizationsWorkbook(summaries);
}
