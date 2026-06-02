import * as XLSX from "xlsx";
import * as productService from "@/modules/products/services/product.service";
import * as importRepo from "@/lib/repositories/import.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { Product } from "@/lib/types";

export const PRODUCT_IMPORT_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "category",
  "base_price",
  "is_active",
  "is_popular",
  "track_inventory",
] as const;

export type ProductImportRow = Record<(typeof PRODUCT_IMPORT_COLUMNS)[number], string>;

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedImportResult {
  rows: ProductImportRow[];
  errors: ImportValidationError[];
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseProductsXlsx(buffer: ArrayBuffer): ParsedImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ProductImportRow[] = raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return {
      name: normalized.name ?? "",
      sku: normalized.sku ?? "",
      barcode: normalized.barcode ?? "",
      category: normalized.category ?? "",
      base_price: normalized.base_price ?? "",
      is_active: normalized.is_active ?? "true",
      is_popular: normalized.is_popular ?? "false",
      track_inventory: normalized.track_inventory ?? "true",
    };
  });

  return { rows, errors: validateProductRows(rows) };
}

export function validateProductRows(rows: ProductImportRow[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const skuSet = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    if (!row.name) errors.push({ row: rowNum, field: "name", message: "Name is required" });
    if (!row.sku) {
      errors.push({ row: rowNum, field: "sku", message: "SKU is required" });
    } else if (skuSet.has(row.sku)) {
      errors.push({ row: rowNum, field: "sku", message: "Duplicate SKU in file" });
    } else {
      skuSet.add(row.sku);
    }
    const price = Number(row.base_price);
    if (row.base_price && Number.isNaN(price)) {
      errors.push({ row: rowNum, field: "base_price", message: "Invalid price" });
    }
  });

  return errors;
}

function parseBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (["true", "yes", "1", "y"].includes(v)) return true;
  if (["false", "no", "0", "n"].includes(v)) return false;
  return fallback;
}

async function resolveCategoryId(
  categoryName: string,
  userId: string
): Promise<string> {
  const categories = await productService.listCategories();
  const existing = categories.find(
    (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
  );
  if (existing) return existing.id;

  const created = await productService.createCategory(
    {
      name: categoryName.trim() || "Imported",
      sort_order: categories.length + 1,
      color: "#94A3B8",
      icon: "package",
    },
    userId
  );
  return created.id;
}

export async function bulkImportProducts(
  rows: ProductImportRow[],
  createdBy: string,
  storeId: string
): Promise<{ imported: Product[]; skipped: number }> {
  await assertPeriodOpen(storeId);
  const existing = await productService.listProducts();
  const existingSkus = new Set(existing.map((p) => p.sku));
  const imported: Product[] = [];
  let skipped = 0;

  const categories = await productService.listCategories();
  const defaultCategoryId =
    categories[0]?.id ??
    (await resolveCategoryId("General", createdBy));

  for (const row of rows) {
    if (!row.name || !row.sku || existingSkus.has(row.sku)) {
      skipped += 1;
      continue;
    }

    const categoryId = row.category
      ? await resolveCategoryId(row.category, createdBy)
      : defaultCategoryId;

    const product = await productService.createProduct(
      {
        name: row.name,
        sku: row.sku,
        barcode: row.barcode || row.sku,
        category_id: categoryId,
        base_price: Number(row.base_price) || 0,
        description: "",
        sale_price: null,
        publish_to_souqna: false,
        image_url: null,
        is_active: parseBool(row.is_active, true),
        is_popular: parseBool(row.is_popular, false),
        track_inventory: parseBool(row.track_inventory, true),
        product_type: "finished",
        unit: "piece",
        last_unit_cost: 0,
        cost_unit: "piece",
      },
      createdBy
    );

    existingSkus.add(product.sku);
    imported.push(product);
  }

  const job = await importRepo.createImportJob({
    type: "products",
    status: "completed",
    file_url: null,
    result: { imported: imported.length, skipped, created_by: createdBy },
    created_by: createdBy,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId,
    userId: createdBy,
    action: "import.completed",
    entityType: "import_job",
    entityId: job.id,
    metadata: { imported: imported.length, skipped },
  });

  return { imported, skipped };
}
