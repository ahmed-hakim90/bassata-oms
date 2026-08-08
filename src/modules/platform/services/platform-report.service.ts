import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import type { PlatformOrganizationSummary } from "@/modules/platform/services/platform-org.service";
import { listOrganizationHealthSummaries } from "@/modules/platform/services/platform-org.service";
import { listPlatformTenantUsers } from "@/modules/platform/services/platform-users.service";
import { listPlatformDevices } from "@/modules/platform/services/platform-ops.service";
import {
  listPlatformUsageMatrix,
  type PlatformPlanId,
} from "@/modules/platform/services/platform-plan.service";
import { ROLE_LABELS } from "@/lib/constants";

const PLAN_LABELS: Record<PlatformPlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  custom: "مخصص",
};

function limitCell(value: number | null): string {
  return value == null ? "∞" : String(value);
}

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
          { header: "سجلات", accessor: (r) => r.devices, width: 8 },
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

export async function exportPlatformUsersReport(): Promise<{
  base64: string;
  fileName: string;
}> {
  const users = await listPlatformTenantUsers({ limit: 500 });
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `platform-users-${stamp}.xlsx`;
  const rows = users.map((user) => ({
    name: user.name,
    email: user.email,
    role: ROLE_LABELS[user.role],
    org: user.org_name,
    org_status: user.org_status === "suspended" ? "معلّقة" : "نشطة",
    active: user.is_active ? "نشط" : "موقوف",
    created_at: user.created_at ?? "",
    user_id: user.id,
    org_id: user.org_id,
  }));
  const workbook = buildReportWorkbook({
    title: "مستخدمو المنصة",
    fileName,
    sheets: [
      {
        name: "Users",
        rows,
        columns: [
          { header: "الاسم", accessor: (r) => r.name, width: 22 },
          { header: "البريد", accessor: (r) => r.email, width: 28 },
          { header: "الدور", accessor: (r) => r.role, width: 12 },
          { header: "الشركة", accessor: (r) => r.org, width: 22 },
          { header: "حالة الشركة", accessor: (r) => r.org_status, width: 12 },
          { header: "الحساب", accessor: (r) => r.active, width: 10 },
          { header: "تاريخ", accessor: (r) => r.created_at, width: 22 },
          { header: "معرّف المستخدم", accessor: (r) => r.user_id, width: 36 },
          { header: "معرّف الشركة", accessor: (r) => r.org_id, width: 36 },
        ],
      },
    ],
  });
  return { base64: workbookToBase64(workbook), fileName };
}

export async function exportPlatformDevicesReport(): Promise<{
  base64: string;
  fileName: string;
}> {
  const devices = await listPlatformDevices({ limit: 500 });
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `platform-devices-${stamp}.xlsx`;
  const rows = devices.map((device) => ({
    name: device.name,
    org: device.org_name,
    store: device.store_name,
    active: device.is_active ? "نشط" : "موقوف",
    last_seen: device.last_seen_at ?? "",
    device_id: device.id,
    store_id: device.store_id,
    org_id: device.org_id,
  }));
  const workbook = buildReportWorkbook({
    title: "سجلات التشغيل",
    fileName,
    sheets: [
      {
        name: "Devices",
        rows,
        columns: [
          { header: "الاسم", accessor: (r) => r.name, width: 22 },
          { header: "الشركة", accessor: (r) => r.org, width: 22 },
          { header: "الفرع", accessor: (r) => r.store, width: 18 },
          { header: "الحالة", accessor: (r) => r.active, width: 10 },
          { header: "آخر ظهور", accessor: (r) => r.last_seen, width: 22 },
          { header: "المعرّف", accessor: (r) => r.device_id, width: 36 },
          { header: "معرّف الفرع", accessor: (r) => r.store_id, width: 36 },
          { header: "معرّف الشركة", accessor: (r) => r.org_id, width: 36 },
        ],
      },
    ],
  });
  return { base64: workbookToBase64(workbook), fileName };
}

export async function exportPlatformUsageReport(): Promise<{
  base64: string;
  fileName: string;
}> {
  const matrix = await listPlatformUsageMatrix();
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `platform-usage-${stamp}.xlsx`;
  const pressureLabel = {
    ok: "طبيعي",
    near: "قرب الحد",
    over: "تجاوز",
  } as const;

  const rows = matrix.map((row) => ({
    name: row.org_name,
    status: row.org_status === "suspended" ? "معلّقة" : "نشطة",
    plan: PLAN_LABELS[row.plan.plan],
    stores: `${row.usage.stores}/${limitCell(row.plan.max_stores)}`,
    users: `${row.usage.users}/${limitCell(row.plan.max_users)}`,
    devices: `${row.usage.devices}/${limitCell(row.plan.max_devices)}`,
    pressure: pressureLabel[row.pressure.worst],
    orders: row.order_count,
    products: row.product_count,
    customers: row.customer_count,
    approx_size: formatBytes(row.database_bytes),
    last_order_at: row.last_order_at ?? "",
    notes: row.plan.notes,
    org_id: row.org_id,
  }));

  const workbook = buildReportWorkbook({
    title: "استهلاك شركات المنصة",
    fileName,
    sheets: [
      {
        name: "Usage",
        rows,
        columns: [
          { header: "الشركة", accessor: (r) => r.name, width: 28 },
          { header: "الحالة", accessor: (r) => r.status, width: 12 },
          { header: "الباقة", accessor: (r) => r.plan, width: 12 },
          { header: "فروع", accessor: (r) => r.stores, width: 12 },
          { header: "مستخدمين", accessor: (r) => r.users, width: 14 },
          { header: "سجلات", accessor: (r) => r.devices, width: 12 },
          { header: "ضغط الحدود", accessor: (r) => r.pressure, width: 12 },
          { header: "طلبات", accessor: (r) => r.orders, width: 10 },
          { header: "منتجات", accessor: (r) => r.products, width: 10 },
          { header: "عملاء", accessor: (r) => r.customers, width: 10 },
          { header: "حجم تقريبي", accessor: (r) => r.approx_size, width: 12 },
          { header: "آخر طلب", accessor: (r) => r.last_order_at, width: 22 },
          { header: "ملاحظات الباقة", accessor: (r) => r.notes, width: 28 },
          { header: "معرّف الشركة", accessor: (r) => r.org_id, width: 36 },
        ],
      },
    ],
  });

  return { base64: workbookToBase64(workbook), fileName };
}
