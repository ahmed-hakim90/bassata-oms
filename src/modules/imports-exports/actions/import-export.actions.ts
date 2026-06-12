"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  bulkImportProducts,
  parseProductsXlsx,
  type ProductImportRow,
} from "../services/import.service";
import {
  buildProductsExportWorkbook,
  buildProductsTemplateWorkbook,
  workbookToBase64,
} from "../services/export.service";

export async function parseProductsFileAction(base64: string) {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const buffer = Buffer.from(base64, "base64");
  return parseProductsXlsx(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

export async function importProductsAction(rows: ProductImportRow[]) {
  await requireFeature("imports_exports");
  const user = await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  const result = await bulkImportProducts(rows, user.id, storeId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/products");
  return result;
}

export async function exportProductsTemplateAction() {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const buffer = buildProductsTemplateWorkbook();
  return {
    filename: "CafeFlow-products-template.xlsx",
    base64: workbookToBase64(buffer),
  };
}

export async function exportProductsDataAction() {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const buffer = await buildProductsExportWorkbook();
  return {
    filename: `CafeFlow-products-${new Date().toISOString().slice(0, 10)}.xlsx`,
    base64: workbookToBase64(buffer),
  };
}
