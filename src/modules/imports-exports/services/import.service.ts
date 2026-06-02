import * as XLSX from "xlsx";
import * as productService from "@/modules/products/services/product.service";
import * as importRepo from "@/lib/repositories/import.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import {
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  MEASUREMENT_UNITS,
  PRODUCT_SALES_UNIT_TYPES,
  PRODUCT_TYPES,
  SHELF_LIFE_UNITS,
} from "@/lib/constants";
import type { Product } from "@/lib/types";

export const PRODUCT_IMPORT_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "category",
  "base_price",
  "sale_price",
  "description",
  "image_url",
  "import_action",
  "product_type",
  "sales_unit_type",
  "unit",
  "base_unit",
  "sale_unit",
  "cost_unit",
  "is_active",
  "is_popular",
  "track_inventory",
  "inventory_tracking_mode",
  "inventory_rotation_method",
  "expiry_tracking_enabled",
  "expiry_policy",
  "shelf_life_value",
  "shelf_life_unit",
  "allow_fractional_quantity",
  "allow_price_input",
  "wholesale_enabled",
  "supports_weight_sale",
  "supports_amount_sale",
  "publish_to_souqna",
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

const IMPORT_ACTIONS = ["upsert", "create", "update"] as const;
type ImportAction = (typeof IMPORT_ACTIONS)[number];

type ProductImportPayload = ProductImportRow & {
  category_id: string;
};

const HEADER_ALIASES: Record<string, (typeof PRODUCT_IMPORT_COLUMNS)[number]> = {
  product_name: "name",
  item_name: "name",
  "اسم_المنتج": "name",
  "المنتج": "name",
  code: "sku",
  product_code: "sku",
  "كود": "sku",
  "كود_المنتج": "sku",
  "باركود": "barcode",
  "الباركود": "barcode",
  category_name: "category",
  "تصنيف": "category",
  "التصنيف": "category",
  cost_price: "base_price",
  purchase_price: "base_price",
  "سعر_التكلفة": "base_price",
  "التكلفة": "base_price",
  price: "sale_price",
  selling_price: "sale_price",
  "سعر_البيع": "sale_price",
  "السعر": "sale_price",
  "الوصف": "description",
  image: "image_url",
  image_url: "image_url",
  "الصورة": "image_url",
  action: "import_action",
  "الإجراء": "import_action",
  "نوع_الاستيراد": "import_action",
  active: "is_active",
  "نشط": "is_active",
  popular: "is_popular",
  "مميز": "is_popular",
  track_stock: "track_inventory",
  "تتبع_المخزون": "track_inventory",
};

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[normalized] ?? normalized;
}

function valueOrDefault(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
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
      sale_price: normalized.sale_price ?? "",
      description: normalized.description ?? "",
      image_url: normalized.image_url ?? "",
      import_action: valueOrDefault(normalized.import_action, "upsert"),
      product_type: valueOrDefault(normalized.product_type, "finished_product"),
      sales_unit_type: valueOrDefault(normalized.sales_unit_type, "piece"),
      unit: valueOrDefault(normalized.unit, "piece"),
      base_unit: valueOrDefault(normalized.base_unit, valueOrDefault(normalized.unit, "piece")),
      sale_unit: valueOrDefault(normalized.sale_unit, valueOrDefault(normalized.unit, "piece")),
      cost_unit: valueOrDefault(
        normalized.cost_unit,
        valueOrDefault(normalized.base_unit, valueOrDefault(normalized.unit, "piece"))
      ),
      is_active: valueOrDefault(normalized.is_active, "true"),
      is_popular: valueOrDefault(normalized.is_popular, "false"),
      track_inventory: valueOrDefault(normalized.track_inventory, "true"),
      inventory_tracking_mode: valueOrDefault(normalized.inventory_tracking_mode, "standard"),
      inventory_rotation_method: valueOrDefault(normalized.inventory_rotation_method, "FIFO"),
      expiry_tracking_enabled: valueOrDefault(normalized.expiry_tracking_enabled, "false"),
      expiry_policy: valueOrDefault(normalized.expiry_policy, "block_sale"),
      shelf_life_value: valueOrDefault(normalized.shelf_life_value, "0"),
      shelf_life_unit: valueOrDefault(normalized.shelf_life_unit, "days"),
      allow_fractional_quantity: valueOrDefault(normalized.allow_fractional_quantity, "false"),
      allow_price_input: valueOrDefault(normalized.allow_price_input, "false"),
      wholesale_enabled: valueOrDefault(normalized.wholesale_enabled, "false"),
      supports_weight_sale: normalized.supports_weight_sale ?? "",
      supports_amount_sale: normalized.supports_amount_sale ?? "",
      publish_to_souqna: valueOrDefault(normalized.publish_to_souqna, "false"),
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
    const salePrice = Number(row.sale_price);
    if (row.sale_price && Number.isNaN(salePrice)) {
      errors.push({ row: rowNum, field: "sale_price", message: "Invalid sale price" });
    }
    if (!IMPORT_ACTIONS.includes(row.import_action as ImportAction)) {
      errors.push({
        row: rowNum,
        field: "import_action",
        message: "Use upsert, create, or update",
      });
    }
    if (!PRODUCT_TYPES.includes(row.product_type as (typeof PRODUCT_TYPES)[number])) {
      errors.push({
        row: rowNum,
        field: "product_type",
        message: "Invalid product type",
      });
    }
    if (
      !PRODUCT_SALES_UNIT_TYPES.includes(
        row.sales_unit_type as (typeof PRODUCT_SALES_UNIT_TYPES)[number]
      )
    ) {
      errors.push({
        row: rowNum,
        field: "sales_unit_type",
        message: "Invalid sales unit type",
      });
    }
    for (const field of ["unit", "base_unit", "sale_unit", "cost_unit"] as const) {
      if (!MEASUREMENT_UNITS.includes(row[field] as (typeof MEASUREMENT_UNITS)[number])) {
        errors.push({ row: rowNum, field, message: "Invalid unit" });
      }
    }
    if (
      !INVENTORY_TRACKING_MODES.includes(
        row.inventory_tracking_mode as (typeof INVENTORY_TRACKING_MODES)[number]
      )
    ) {
      errors.push({
        row: rowNum,
        field: "inventory_tracking_mode",
        message: "Invalid tracking mode",
      });
    }
    if (
      !INVENTORY_ROTATION_METHODS.includes(
        row.inventory_rotation_method as (typeof INVENTORY_ROTATION_METHODS)[number]
      )
    ) {
      errors.push({
        row: rowNum,
        field: "inventory_rotation_method",
        message: "Invalid rotation method",
      });
    }
    if (!EXPIRY_POLICIES.includes(row.expiry_policy as (typeof EXPIRY_POLICIES)[number])) {
      errors.push({
        row: rowNum,
        field: "expiry_policy",
        message: "Invalid expiry policy",
      });
    }
    if (!SHELF_LIFE_UNITS.includes(row.shelf_life_unit as (typeof SHELF_LIFE_UNITS)[number])) {
      errors.push({
        row: rowNum,
        field: "shelf_life_unit",
        message: "Invalid shelf life unit",
      });
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

function rowToProductInput(row: ProductImportPayload): productService.ProductInput {
  return {
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || row.sku,
    category_id: row.category_id,
    base_price: Number(row.base_price) || 0,
    description: row.description,
    sale_price: row.sale_price ? Number(row.sale_price) : null,
    publish_to_souqna: parseBool(row.publish_to_souqna, false),
    image_url: row.image_url || null,
    is_active: parseBool(row.is_active, true),
    is_popular: parseBool(row.is_popular, false),
    track_inventory: parseBool(row.track_inventory, true),
    product_type: (row.product_type as Product["product_type"]) ?? "finished_product",
    inventory_tracking_mode:
      (row.inventory_tracking_mode as Product["inventory_tracking_mode"]) ?? "standard",
    inventory_rotation_method:
      (row.inventory_rotation_method as Product["inventory_rotation_method"]) ?? "FIFO",
    expiry_tracking_enabled: parseBool(row.expiry_tracking_enabled, false),
    expiry_policy: (row.expiry_policy as Product["expiry_policy"]) ?? "block_sale",
    shelf_life_value: Number(row.shelf_life_value) || 0,
    shelf_life_unit: (row.shelf_life_unit as Product["shelf_life_unit"]) ?? "days",
    unit: (row.unit as Product["unit"]) ?? "piece",
    base_unit: (row.base_unit as Product["base_unit"]) ?? "piece",
    sale_unit: (row.sale_unit as Product["sale_unit"]) ?? "piece",
    sales_unit_type: (row.sales_unit_type as Product["sales_unit_type"]) ?? "piece",
    allow_fractional_quantity: parseBool(row.allow_fractional_quantity, false),
    allow_price_input: parseBool(row.allow_price_input, false),
    wholesale_enabled: parseBool(row.wholesale_enabled, false),
    supports_weight_sale: row.supports_weight_sale
      ? parseBool(row.supports_weight_sale, false)
      : undefined,
    supports_amount_sale: row.supports_amount_sale
      ? parseBool(row.supports_amount_sale, false)
      : undefined,
    last_unit_cost: 0,
    cost_unit: (row.cost_unit as Product["cost_unit"]) ?? "piece",
  };
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
): Promise<{ imported: Product[]; updated: Product[]; skipped: number }> {
  await assertPeriodOpen(storeId);
  const existing = await productService.listProducts();
  const existingBySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]));
  const imported: Product[] = [];
  const updated: Product[] = [];
  let skipped = 0;

  const categories = await productService.listCategories();
  const defaultCategoryId =
    categories[0]?.id ??
    (await resolveCategoryId("General", createdBy));

  for (const row of rows) {
    if (!row.name || !row.sku) {
      skipped += 1;
      continue;
    }

    const categoryId = row.category
      ? await resolveCategoryId(row.category, createdBy)
      : defaultCategoryId;

    const action = row.import_action as ImportAction;
    const existingProduct = existingBySku.get(row.sku.toLowerCase());
    const payload = rowToProductInput({ ...row, category_id: categoryId });

    if (existingProduct) {
      if (action === "create") {
        skipped += 1;
        continue;
      }
      const product = await productService.updateProduct(existingProduct.id, payload, createdBy);
      if (product) updated.push(product);
      continue;
    }

    if (action === "update") {
      skipped += 1;
      continue;
    }

    const product = await productService.createProduct(payload, createdBy);
    existingBySku.set(product.sku.toLowerCase(), product);
    imported.push(product);
  }

  const job = await importRepo.createImportJob({
    type: "products",
    status: "completed",
    file_url: null,
    result: { imported: imported.length, updated: updated.length, skipped, created_by: createdBy },
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
    metadata: { imported: imported.length, updated: updated.length, skipped },
  });

  return { imported, updated, skipped };
}
