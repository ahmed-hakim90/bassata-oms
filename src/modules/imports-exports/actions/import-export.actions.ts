"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  bulkImportProducts,
  parseProductsXlsx,
  type ParsedImportResult,
  type ProductImportRow,
  type ImportValidationError,
} from "../services/import.service";
import {
  buildProductsExportWorkbook,
  buildProductsTemplateWorkbook,
  templateFilenameForActivity,
  workbookToBase64,
} from "../services/export.service";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";

export type ImportProductsSummary = {
  imported: number;
  updated: number;
  unchanged: number;
  skipped: number;
  variantsImported: number;
  variantsUpdated: number;
  variantsUnchanged: number;
  recipeGroupsImported: number;
  warnings: ImportValidationError[];
};

export async function parseProductsFileAction(base64: string) {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const buffer = Buffer.from(base64, "base64");
  return parseProductsXlsx(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

export async function importProductsAction(
  input: ProductImportRow[] | ParsedImportResult
): Promise<ImportProductsSummary> {
  await requireFeature("imports_exports");
  if (!Array.isArray(input) && input.recipes.length > 0) {
    await requireFeature("recipes");
    await requirePermissionOrRole("recipe_manage", ["owner", "manager"]);
  }
  const user = await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  const result = await bulkImportProducts(input, user.id, storeId);

  // Return a slim summary first so the dialog can exit "importing".
  // Full Product[] payloads + sync revalidatePath were keeping the UI stuck
  // after the DB work already finished.
  after(() => {
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/reports");
  });

  return {
    imported: result.imported.length,
    updated: result.updated.length,
    unchanged: result.unchanged.length,
    skipped: result.skipped,
    variantsImported: result.variantsImported.length,
    variantsUpdated: result.variantsUpdated.length,
    variantsUnchanged: result.variantsUnchanged.length,
    recipeGroupsImported: result.recipeGroupsImported,
    warnings: result.warnings,
  };
}

export async function exportProductsTemplateAction() {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const activity = await getBusinessActivitySettings();
  const buffer = buildProductsTemplateWorkbook(activity);
  return {
    filename: templateFilenameForActivity(activity.activity_type),
    base64: workbookToBase64(buffer),
    activityType: activity.activity_type,
  };
}

export async function exportProductsDataAction() {
  await requireFeature("imports_exports");
  await requirePermissionOrRole("imports_exports", ["owner", "manager"]);
  const buffer = await buildProductsExportWorkbook();
  return {
    filename: `Velora-products-${new Date().toISOString().slice(0, 10)}.xlsx`,
    base64: workbookToBase64(buffer),
  };
}
