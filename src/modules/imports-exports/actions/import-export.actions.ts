"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  bulkImportProducts,
  parseProductsXlsx,
  type ParsedImportResult,
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

export async function importProductsAction(input: ProductImportRow[] | ParsedImportResult) {
  await requireFeature("imports_exports");
  if (!Array.isArray(input) && input.recipes.length > 0) {
    await requireFeature("recipes");
    await requirePermissionOrRole("recipe_manage", ["owner", "manager"]);
  }
  const user = await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  const result = await bulkImportProducts(input, user.id, storeId);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/reports");
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
