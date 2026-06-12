"use server";

import { requireAuth, requirePermission, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  canExportExcel,
  canExportPdf,
  canPrintReports,
  canViewFinancialReports,
  canViewProfitReports,
  type PermissionKey,
  type UserRole,
} from "@/lib/constants";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";

export interface ReportCapabilities {
  canPrint: boolean;
  canExcel: boolean;
  canPdf: boolean;
  canViewProfit: boolean;
  canViewFinancial: boolean;
  role: UserRole;
  permissions: Set<PermissionKey>;
}

export async function getReportCapabilities(): Promise<ReportCapabilities> {
  const user = await requireAuth();
  const permissions = await getEffectivePermissions(user);
  return {
    canPrint: canPrintReports(user.role, permissions),
    canExcel: canExportExcel(user.role, permissions),
    canPdf: canExportPdf(user.role, permissions),
    canViewProfit: canViewProfitReports(user.role, permissions),
    canViewFinancial: canViewFinancialReports(user.role, permissions),
    role: user.role,
    permissions,
  };
}

export async function requireReportPrintAccess(): Promise<void> {
  const user = await requireAuth();
  const permissions = await getEffectivePermissions(user);
  if (!canPrintReports(user.role, permissions)) {
    throw new Error("Insufficient permissions to print reports");
  }
}

export async function requireReportExcelAccess(): Promise<void> {
  await requirePermissionOrRole("reports_export_excel", ["owner", "manager"]);
}

export async function requireReportPdfAccess(): Promise<void> {
  await requirePermissionOrRole("reports_export_pdf", ["owner", "manager"]);
}

export async function requireProfitReportAccess(): Promise<void> {
  const user = await requireAuth();
  const permissions = await getEffectivePermissions(user);
  if (!canViewProfitReports(user.role, permissions)) {
    throw new Error("Insufficient permissions to view profit reports");
  }
}

export async function requireFinancialReportAccess(): Promise<void> {
  const user = await requireAuth();
  const permissions = await getEffectivePermissions(user);
  if (!canViewFinancialReports(user.role, permissions)) {
    throw new Error("Insufficient permissions to view financial reports");
  }
}

export async function requireCustomerStatementAccess(): Promise<void> {
  await requirePermissionOrRole("customer_statement_view", ["owner", "manager"]);
}

export async function requireSupplierStatementAccess(): Promise<void> {
  await requirePermissionOrRole("supplier_statement_view", ["owner", "manager", "inventory"]);
}

export async function requireBarcodeLabelAccess(): Promise<void> {
  await requirePermissionOrRole("barcode_label_print", ["owner", "manager", "inventory"]);
}

export async function requireReportsView() {
  return requirePermissionOrRole("reports_view", ["owner", "manager"]);
}
