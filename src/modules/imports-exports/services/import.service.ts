import * as XLSX from "xlsx";
import * as productService from "@/modules/products/services/product.service";
import * as recipeService from "@/modules/products/services/recipe.service";
import * as variantService from "@/modules/products/services/variant.service";
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
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";
import type { MeasurementUnit, Product, ProductVariant } from "@/lib/types";

export const PRODUCT_IMPORT_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "category",
  "definition",
  "base_price",
  "last_unit_cost",
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
  "units_per_purchase_unit",
] as const;

export const PRODUCT_IMPORT_SIMPLE_COLUMNS = [
  "name",
  "sku",
  "category",
  "definition",
  "base_price",
  "barcode",
  "unit",
  "track_inventory",
  "import_action",
] as const;

export const PRODUCT_IMPORT_SUPERMARKET_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "category",
  "definition",
  "base_price",
  "last_unit_cost",
  "unit",
  "cost_unit",
  "units_per_purchase_unit",
  "track_inventory",
  "import_action",
] as const;

export const PRODUCT_VARIANT_IMPORT_COLUMNS = [
  "product_sku",
  "variant_name",
  "variant_sku",
  "barcode",
  "price",
  "is_active",
  "import_action",
] as const;

export const PRODUCT_RECIPE_IMPORT_COLUMNS = [
  "product_sku",
  "variant_sku",
  "ingredient_sku",
  "quantity",
  "unit",
] as const;

export type ProductImportRow = Record<(typeof PRODUCT_IMPORT_COLUMNS)[number], string>;
export type ProductVariantImportRow = Record<(typeof PRODUCT_VARIANT_IMPORT_COLUMNS)[number], string>;
export type ProductRecipeImportRow = Record<(typeof PRODUCT_RECIPE_IMPORT_COLUMNS)[number], string>;

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedImportResult {
  rows: ProductImportRow[];
  variants: ProductVariantImportRow[];
  recipes: ProductRecipeImportRow[];
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
}

const IMPORT_ACTIONS = ["upsert", "create", "update", "cancel", "deactivate"] as const;
type ImportAction = (typeof IMPORT_ACTIONS)[number];

type ProductImportPayload = ProductImportRow & {
  category_id: string;
};

const PRODUCT_SHEET_ALIASES = [
  "products",
  "items",
  "menu",
  "المنتجات",
  "منتجات",
  "الأصناف",
  "اصناف",
] as const;

const VARIANT_SHEET_ALIASES = [
  "variants",
  "product_variants",
  "sizes",
  "product_sizes",
  "الأحجام",
  "احجام",
  "الحجوم",
  "المقاسات",
  "مقاسات",
] as const;

const RECIPE_SHEET_ALIASES = [
  "recipes",
  "recipe",
  "components",
  "ingredients",
  "الوصفات",
  "وصفات",
  "المكونات",
  "مكونات",
] as const;

const HEADER_ALIASES: Record<string, (typeof PRODUCT_IMPORT_COLUMNS)[number]> = {
  product_name: "name",
  item_name: "name",
  "اسم_المنتج": "name",
  "المنتج": "name",
  "اسم": "name",
  name_ar: "name",
  code: "sku",
  product_code: "sku",
  item_code: "sku",
  "كود": "sku",
  "كود_المنتج": "sku",
  "كود_الصنف": "sku",
  "باركود": "barcode",
  "الباركود": "barcode",
  category_name: "category",
  group: "category",
  "تصنيف": "category",
  "التصنيف": "category",
  "القسم": "category",
  definition: "definition",
  type: "definition",
  kind: "definition",
  product_kind: "definition",
  item_type: "definition",
  "تعريف": "definition",
  "التعريف": "definition",
  "نوع": "definition",
  "النوع": "definition",
  "نوع_المنتج": "definition",
  "نوع_الصنف": "definition",
  price: "base_price",
  "السعر": "base_price",
  "سعر": "base_price",
  selling_price: "base_price",
  "سعر_البيع": "base_price",
  "سعر_الكيلو": "base_price",
  cost_price: "last_unit_cost",
  purchase_price: "last_unit_cost",
  unit_cost: "last_unit_cost",
  last_unit_cost: "last_unit_cost",
  "سعر_التكلفة": "last_unit_cost",
  "التكلفة": "last_unit_cost",
  "سعر_الشراء": "last_unit_cost",
  "سعر_الشرا": "last_unit_cost",
  sale_price: "sale_price",
  "الوصف": "description",
  image: "image_url",
  image_url: "image_url",
  "الصورة": "image_url",
  action: "import_action",
  "الإجراء": "import_action",
  "نوع_الاستيراد": "import_action",
  active: "is_active",
  "نشط": "is_active",
  status: "is_active",
  popular: "is_popular",
  "مميز": "is_popular",
  "الوحدة": "unit",
  "وحدة": "unit",
  "وحدة_البيع": "unit",
  track_stock: "track_inventory",
  "تتبع_المخزون": "track_inventory",
  "سعر_حسب_الكمية": "allow_price_input",
  "نوع_وحدة_البيع": "sales_unit_type",
  "وحدة_الشراء": "cost_unit",
  "قطع_في_الكرتونة": "units_per_purchase_unit",
  "عدد_القطع": "units_per_purchase_unit",
  units_per_pack: "units_per_purchase_unit",
  units_per_carton: "units_per_purchase_unit",
  purchase_unit: "cost_unit",
};

const VARIANT_HEADER_ALIASES: Record<string, (typeof PRODUCT_VARIANT_IMPORT_COLUMNS)[number]> = {
  product: "product_sku",
  product_code: "product_sku",
  product_sku: "product_sku",
  item_code: "product_sku",
  "كود_المنتج": "product_sku",
  "كود_الصنف": "product_sku",
  variant: "variant_name",
  name: "variant_name",
  size: "variant_name",
  size_name: "variant_name",
  variant_name: "variant_name",
  "الحجم": "variant_name",
  "اسم_الحجم": "variant_name",
  variant_code: "variant_sku",
  sku: "variant_sku",
  variant_sku: "variant_sku",
  size_code: "variant_sku",
  "كود_الحجم": "variant_sku",
  barcode: "barcode",
  "باركود": "barcode",
  price: "price",
  fixed_price: "price",
  variant_price: "price",
  sale_price: "price",
  selling_price: "price",
  "السعر": "price",
  "سعر": "price",
  "سعر_الحجم": "price",
  "سعر_البيع": "price",
  active: "is_active",
  is_active: "is_active",
  "نشط": "is_active",
  status: "is_active",
  action: "import_action",
  import_action: "import_action",
  "الإجراء": "import_action",
  "نوع_الاستيراد": "import_action",
};

const RECIPE_HEADER_ALIASES: Record<string, (typeof PRODUCT_RECIPE_IMPORT_COLUMNS)[number]> = {
  product: "product_sku",
  product_code: "product_sku",
  product_sku: "product_sku",
  item_code: "product_sku",
  "كود_المنتج": "product_sku",
  "كود_الصنف": "product_sku",
  variant_code: "variant_sku",
  variant_sku: "variant_sku",
  size_code: "variant_sku",
  "كود_الحجم": "variant_sku",
  ingredient_code: "ingredient_sku",
  ingredient: "ingredient_sku",
  sku: "ingredient_sku",
  ingredient_sku: "ingredient_sku",
  component_sku: "ingredient_sku",
  "كود_المكون": "ingredient_sku",
  quantity: "quantity",
  qty: "quantity",
  "الكمية": "quantity",
  unit: "unit",
  "الوحدة": "unit",
};

type DefinitionDefaults = Partial<
  Pick<
    ProductImportRow,
    | "product_type"
    | "sales_unit_type"
    | "track_inventory"
    | "inventory_tracking_mode"
    | "inventory_rotation_method"
    | "allow_fractional_quantity"
    | "allow_price_input"
    | "unit"
    | "cost_unit"
    | "units_per_purchase_unit"
  >
>;

const PRODUCT_DEFINITION_DEFAULTS: Record<string, DefinitionDefaults> = {
  menu_item: {
    product_type: "finished_product",
    sales_unit_type: "piece",
    track_inventory: "false",
    inventory_tracking_mode: "none",
  },
  retail_product: {
    product_type: "finished_product",
    track_inventory: "true",
    inventory_tracking_mode: "standard",
  },
  supermarket_weight_product: {
    product_type: "finished_product",
    sales_unit_type: "weight",
    unit: "kg",
    track_inventory: "true",
    inventory_tracking_mode: "batch_and_expiry",
    inventory_rotation_method: "FEFO",
    allow_fractional_quantity: "true",
    allow_price_input: "true",
  },
  ingredient: {
    product_type: "ingredient",
    track_inventory: "true",
    inventory_tracking_mode: "standard",
  },
  service: {
    product_type: "service",
    sales_unit_type: "piece",
    track_inventory: "false",
    inventory_tracking_mode: "none",
  },
};

const PRODUCT_DEFINITION_ALIASES: Record<string, keyof typeof PRODUCT_DEFINITION_DEFAULTS> = {
  menu: "menu_item",
  item: "menu_item",
  menuitem: "menu_item",
  menu_item: "menu_item",
  finished: "menu_item",
  finished_product: "menu_item",
  "عنصر_قائمة": "menu_item",
  "صنف_قائمة": "menu_item",
  "منتج_للبيع": "menu_item",
  "منتج": "menu_item",
  "صنف": "menu_item",
  "مشروب": "menu_item",
  "وجبة": "menu_item",
  retail: "retail_product",
  retail_product: "retail_product",
  stock: "retail_product",
  stock_product: "retail_product",
  inventory_product: "retail_product",
  "منتج_مخزون": "retail_product",
  "منتج_بتتبع_مخزون": "retail_product",
  supermarket_weight_product: "supermarket_weight_product",
  weight_product: "supermarket_weight_product",
  "منتج_وزني": "supermarket_weight_product",
  "وزني": "supermarket_weight_product",
  ingredient: "ingredient",
  raw: "ingredient",
  raw_material: "ingredient",
  "مكون": "ingredient",
  "مكوّن": "ingredient",
  "مادة_خام": "ingredient",
  "خام": "ingredient",
  service: "service",
  "خدمة": "service",
};

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[normalized] ?? normalized;
}

function normalizeVariantHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return VARIANT_HEADER_ALIASES[normalized] ?? normalized;
}

function normalizeRecipeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return RECIPE_HEADER_ALIASES[normalized] ?? normalized;
}

function normalizeSheetName(value: string): string {
  return normalizeToken(value).replace(/_/g, "");
}

function findSheetName(workbook: XLSX.WorkBook, aliases: string[]): string | undefined {
  const normalizedAliases = new Set(aliases.map(normalizeSheetName));
  return workbook.SheetNames.find((name) => normalizedAliases.has(normalizeSheetName(name)));
}

function sheetNameMatches(name: string | undefined, aliases: readonly string[]): boolean {
  if (!name) return false;
  const normalized = normalizeSheetName(name);
  return aliases.some((alias) => normalizeSheetName(alias) === normalized);
}

function rowHasValue(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) => String(value ?? "").trim() !== "");
}

function valueOrDefault(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[ـ-]+/g, "_").replace(/\s+/g, "_");
}

function definitionKey(value: string): keyof typeof PRODUCT_DEFINITION_DEFAULTS | null {
  if (!value.trim()) return null;
  const normalized = normalizeToken(value);
  return PRODUCT_DEFINITION_ALIASES[normalized] ?? null;
}

function definitionDefaults(value: string): DefinitionDefaults {
  const key = definitionKey(value);
  return key ? PRODUCT_DEFINITION_DEFAULTS[key] : PRODUCT_DEFINITION_DEFAULTS.menu_item;
}

function salesUnitTypeForUnit(unit: string): ProductImportRow["sales_unit_type"] {
  if (unit === "kg" || unit === "gram") return "weight";
  if (unit === "liter" || unit === "ml") return "volume";
  return "piece";
}

export function parseProductsXlsx(buffer: ArrayBuffer): ParsedImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const explicitProductsSheetName = findSheetName(workbook, [...PRODUCT_SHEET_ALIASES]);
  const firstSheetName = workbook.SheetNames[0];
  const productsSheetName =
    explicitProductsSheetName ??
    (sheetNameMatches(firstSheetName, VARIANT_SHEET_ALIASES) ||
    sheetNameMatches(firstSheetName, RECIPE_SHEET_ALIASES)
      ? undefined
      : firstSheetName);
  const raw = productsSheetName
    ? XLSX.utils
        .sheet_to_json<Record<string, unknown>>(workbook.Sheets[productsSheetName], { defval: "" })
        .filter(rowHasValue)
    : [];

  const rows: ProductImportRow[] = raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    const definition = normalized.definition ?? "";
    const defaults = definitionDefaults(definition);
    const unit = valueOrDefault(normalized.unit, defaults.unit ?? "piece");
    const basePrice = valueOrDefault(normalized.base_price, normalized.sale_price ?? "");
    return {
      name: normalized.name ?? "",
      sku: normalized.sku ?? "",
      barcode: normalized.barcode ?? "",
      category: normalized.category ?? "",
      definition,
      base_price: basePrice,
      last_unit_cost: normalized.last_unit_cost ?? "",
      sale_price: normalized.sale_price ?? "",
      description: normalized.description ?? "",
      image_url: normalized.image_url ?? "",
      import_action: valueOrDefault(normalized.import_action, "upsert"),
      product_type: valueOrDefault(normalized.product_type, defaults.product_type ?? "finished_product"),
      sales_unit_type: valueOrDefault(
        normalized.sales_unit_type,
        defaults.sales_unit_type ?? salesUnitTypeForUnit(unit)
      ),
      unit,
      base_unit: valueOrDefault(normalized.base_unit, unit),
      sale_unit: valueOrDefault(normalized.sale_unit, unit),
      cost_unit: valueOrDefault(
        normalized.cost_unit,
        defaults.cost_unit ?? valueOrDefault(normalized.base_unit, unit)
      ),
      is_active: valueOrDefault(normalized.is_active, "true"),
      is_popular: valueOrDefault(normalized.is_popular, "false"),
      track_inventory: valueOrDefault(normalized.track_inventory, defaults.track_inventory ?? "true"),
      inventory_tracking_mode: valueOrDefault(
        normalized.inventory_tracking_mode,
        defaults.inventory_tracking_mode ?? "standard"
      ),
      inventory_rotation_method: valueOrDefault(
        normalized.inventory_rotation_method,
        defaults.inventory_rotation_method ?? "FIFO"
      ),
      expiry_tracking_enabled: valueOrDefault(normalized.expiry_tracking_enabled, "false"),
      expiry_policy: valueOrDefault(normalized.expiry_policy, "block_sale"),
      shelf_life_value: valueOrDefault(normalized.shelf_life_value, "0"),
      shelf_life_unit: valueOrDefault(normalized.shelf_life_unit, "days"),
      allow_fractional_quantity: valueOrDefault(
        normalized.allow_fractional_quantity,
        defaults.allow_fractional_quantity ?? (unit === "piece" ? "false" : "true")
      ),
      allow_price_input: valueOrDefault(
        normalized.allow_price_input,
        defaults.allow_price_input ?? "false"
      ),
      wholesale_enabled: valueOrDefault(normalized.wholesale_enabled, "false"),
      supports_weight_sale: normalized.supports_weight_sale ?? "",
      supports_amount_sale: normalized.supports_amount_sale ?? "",
      units_per_purchase_unit: valueOrDefault(
        normalized.units_per_purchase_unit,
        defaults.units_per_purchase_unit ?? "1"
      ),
    };
  });

  const variants = parseVariantSheet(workbook);
  const recipes = parseRecipeSheet(workbook);
  const errors = [
    ...validateProductRows(rows),
    ...validateVariantRows(variants),
    ...validateRecipeRows(recipes),
  ];
  const warnings = buildImportWarnings(rows, variants, recipes);

  return { rows, variants, recipes, errors, warnings };
}

function parseVariantSheet(workbook: XLSX.WorkBook): ProductVariantImportRow[] {
  const sheetName = findSheetName(workbook, [...VARIANT_SHEET_ALIASES]);
  if (!sheetName) return [];
  const raw = XLSX.utils
    .sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: "",
    })
    .filter(rowHasValue);
  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeVariantHeader(key)] = String(value ?? "").trim();
    }
    return {
      product_sku: normalized.product_sku ?? "",
      variant_name: normalized.variant_name ?? "",
      variant_sku: normalized.variant_sku ?? "",
      barcode: normalized.barcode ?? "",
      price: normalized.price ?? "",
      is_active: valueOrDefault(normalized.is_active, "true"),
      import_action: valueOrDefault(normalized.import_action, "upsert"),
    };
  });
}

function parseRecipeSheet(workbook: XLSX.WorkBook): ProductRecipeImportRow[] {
  const sheetName = findSheetName(workbook, [...RECIPE_SHEET_ALIASES]);
  if (!sheetName) return [];
  const raw = XLSX.utils
    .sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: "",
    })
    .filter(rowHasValue);
  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeRecipeHeader(key)] = String(value ?? "").trim();
    }
    return {
      product_sku: normalized.product_sku ?? "",
      variant_sku: normalized.variant_sku ?? "",
      ingredient_sku: normalized.ingredient_sku ?? "",
      quantity: normalized.quantity ?? "",
      unit: valueOrDefault(normalized.unit, "piece"),
    };
  });
}

export function validateProductRows(rows: ProductImportRow[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const skuSet = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const action = row.import_action as ImportAction;
    if (!row.name && !isDeactivateAction(action)) {
      errors.push({ row: rowNum, field: "name", message: "Name is required" });
    }
    if (isDeactivateAction(action) && !row.sku) {
      errors.push({ row: rowNum, field: "sku", message: "SKU is required to cancel a product" });
    }
    if (row.sku && skuSet.has(row.sku)) {
      errors.push({ row: rowNum, field: "sku", message: "Duplicate SKU in file" });
    } else if (row.sku) {
      skuSet.add(row.sku);
    }
    if (row.definition && !definitionKey(row.definition)) {
      errors.push({
        row: rowNum,
        field: "definition",
        message: "Use menu_item, retail_product, supermarket_weight_product, ingredient, or service",
      });
    }
    const price = Number(row.base_price);
    if (row.base_price && Number.isNaN(price)) {
      errors.push({ row: rowNum, field: "base_price", message: "Invalid price" });
    }
    const salePrice = Number(row.sale_price);
    if (row.sale_price && Number.isNaN(salePrice)) {
      errors.push({ row: rowNum, field: "sale_price", message: "Invalid sale price" });
    }
    if (!IMPORT_ACTIONS.includes(action)) {
      errors.push({
        row: rowNum,
        field: "import_action",
        message: "Use upsert, create, update, cancel, or deactivate",
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

export function validateVariantRows(rows: ProductVariantImportRow[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const variantSkuSet = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    if (!row.product_sku) {
      errors.push({ row: rowNum, field: "product_sku", message: "Product SKU is required" });
    }
    const action = row.import_action as ImportAction;
    if (!row.variant_name && !isDeactivateAction(action)) {
      errors.push({ row: rowNum, field: "variant_name", message: "Variant name is required" });
    }
    if (isDeactivateAction(action) && !row.variant_sku) {
      errors.push({ row: rowNum, field: "variant_sku", message: "Variant SKU is required to cancel a variant" });
    }
    const price = Number(row.price);
    if (!row.price && action !== "cancel" && action !== "deactivate") {
      errors.push({ row: rowNum, field: "price", message: "Valid variant price is required" });
    } else if (row.price && (Number.isNaN(price) || price < 0)) {
      errors.push({ row: rowNum, field: "price", message: "Valid variant price is required" });
    }
    if (!IMPORT_ACTIONS.includes(action)) {
      errors.push({
        row: rowNum,
        field: "import_action",
        message: "Use upsert, create, update, cancel, or deactivate",
      });
    }
    if (row.variant_sku) {
      const key = `${row.product_sku.toLowerCase()}::${row.variant_sku.toLowerCase()}`;
      if (variantSkuSet.has(key)) {
        errors.push({ row: rowNum, field: "variant_sku", message: "Duplicate variant SKU in file" });
      }
      variantSkuSet.add(key);
    }
  });

  return errors;
}

export function validateRecipeRows(rows: ProductRecipeImportRow[]): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    if (!row.product_sku) {
      errors.push({ row: rowNum, field: "product_sku", message: "Product SKU is required" });
    }
    if (!row.variant_sku) {
      errors.push({ row: rowNum, field: "variant_sku", message: "Variant SKU is required" });
    }
    if (!row.ingredient_sku) {
      errors.push({ row: rowNum, field: "ingredient_sku", message: "Ingredient SKU is required" });
    }
    const qty = Number(row.quantity);
    if (!row.quantity || Number.isNaN(qty) || qty <= 0) {
      errors.push({ row: rowNum, field: "quantity", message: "Quantity must be greater than zero" });
    }
    if (!MEASUREMENT_UNITS.includes(row.unit as MeasurementUnit)) {
      errors.push({ row: rowNum, field: "unit", message: "Invalid unit" });
    }
  });

  return errors;
}

function buildImportWarnings(
  rows: ProductImportRow[],
  variants: ProductVariantImportRow[],
  recipes: ProductRecipeImportRow[]
): ImportValidationError[] {
  const warnings: ImportValidationError[] = [];
  const productSkus = new Set(rows.map((row) => row.sku).filter(Boolean).map((sku) => sku.toLowerCase()));
  const recipeKeys = new Set(
    recipes.map((row) => `${row.product_sku.toLowerCase()}::${row.variant_sku.toLowerCase()}`)
  );

  variants.forEach((variant, index) => {
    const key = `${variant.product_sku.toLowerCase()}::${variant.variant_sku.toLowerCase()}`;
    if (!recipeKeys.has(key)) {
      warnings.push({
        row: index + 2,
        field: "Recipes",
        message: "Variant has no recipe; sales will have zero cost until a recipe is added",
      });
    }
    if (!productSkus.has(variant.product_sku.toLowerCase())) {
      warnings.push({
        row: index + 2,
        field: "product_sku",
        message: "Product SKU is not in Products sheet; import will use an existing product if found",
      });
    }
  });

  return warnings;
}

function parseBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (["true", "yes", "1", "y", "نعم", "صح"].includes(v)) return true;
  if (["false", "no", "0", "n", "لا", "خطأ"].includes(v)) return false;
  return fallback;
}

function isDeactivateAction(action: string): boolean {
  return action === "cancel" || action === "deactivate";
}

function numbersEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  return Number(a ?? 0) === Number(b ?? 0);
}

function productMatchesPayload(
  product: Product,
  payload: productService.ProductInput
): boolean {
  const payloadProductType =
    payload.product_type === "ingredient" || payload.product_type === "raw_material"
      ? "ingredient"
      : "finished";
  return (
    product.name === payload.name &&
    product.sku === payload.sku &&
    product.barcode === payload.barcode &&
    product.category_id === payload.category_id &&
    numbersEqual(product.base_price, payload.base_price) &&
    (product.description ?? "") === (payload.description ?? "") &&
    numbersEqual(product.sale_price, payload.sale_price) &&
    (product.image_url ?? null) === (payload.image_url ?? null) &&
    product.is_active === payload.is_active &&
    product.is_popular === payload.is_popular &&
    product.track_inventory === payload.track_inventory &&
    product.product_type === payloadProductType &&
    product.inventory_tracking_mode === payload.inventory_tracking_mode &&
    product.inventory_rotation_method === payload.inventory_rotation_method &&
    product.expiry_tracking_enabled === payload.expiry_tracking_enabled &&
    product.expiry_policy === payload.expiry_policy &&
    numbersEqual(product.shelf_life_value, payload.shelf_life_value) &&
    product.shelf_life_unit === payload.shelf_life_unit &&
    product.unit === payload.unit &&
    product.base_unit === payload.base_unit &&
    product.sale_unit === payload.sale_unit &&
    product.sales_unit_type === payload.sales_unit_type &&
    product.allow_fractional_quantity === payload.allow_fractional_quantity &&
    product.allow_price_input === payload.allow_price_input &&
    product.wholesale_enabled === payload.wholesale_enabled &&
    numbersEqual(product.last_unit_cost, payload.last_unit_cost) &&
    product.cost_unit === payload.cost_unit &&
    numbersEqual(product.units_per_purchase_unit ?? 1, payload.units_per_purchase_unit ?? 1)
  );
}

function variantMatchesPayload(
  variant: ProductVariant,
  payload: Omit<ProductVariant, "id" | "product_id">
): boolean {
  return (
    variant.name === payload.name &&
    variant.sku === payload.sku &&
    variant.barcode === payload.barcode &&
    numbersEqual(variant.price_delta, payload.price_delta) &&
    numbersEqual(variant.price, payload.price) &&
    (variant.image_url ?? null) === (payload.image_url ?? null) &&
    variant.is_active === payload.is_active &&
    variant.variant_kind === payload.variant_kind &&
    numbersEqual(variant.quantity_value, payload.quantity_value) &&
    variant.quantity_unit === payload.quantity_unit &&
    variant.price_mode === payload.price_mode &&
    numbersEqual(variant.fixed_price, payload.fixed_price)
  );
}

function buildGeneratedVariantSku(productSku: string, variantName: string): string {
  const suffix = variantName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return [productSku.trim(), suffix || "VAR"].filter(Boolean).join("-");
}

function rowToProductInput(row: ProductImportPayload): productService.ProductInput {
  const productType = row.product_type as Product["product_type"];
  const basePrice = Number(row.base_price) || 0;
  const isIngredient = productType === "ingredient" || productType === "raw_material";
  return {
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || row.sku,
    category_id: row.category_id,
    base_price: isIngredient ? 0 : basePrice,
    description: row.description,
    sale_price: row.sale_price ? Number(row.sale_price) : null,
    image_url: row.image_url || null,
    is_active: parseBool(row.is_active, true),
    is_popular: parseBool(row.is_popular, false),
    show_on_online_menu: !isIngredient,
    track_inventory: parseBool(row.track_inventory, true),
    product_type: productType ?? "finished_product",
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
    last_unit_cost: (() => {
      const fromColumn = Number(row.last_unit_cost);
      if (Number.isFinite(fromColumn) && fromColumn >= 0 && String(row.last_unit_cost ?? "").trim() !== "") {
        return fromColumn;
      }
      // Legacy ingredient templates put cost in base_price.
      return isIngredient ? basePrice : 0;
    })(),
    cost_unit: (row.cost_unit as Product["cost_unit"]) ?? "piece",
    units_per_purchase_unit: Math.max(1, Number(row.units_per_purchase_unit) || 1),
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
  input: ProductImportRow[] | ParsedImportResult,
  createdBy: string,
  storeId: string
): Promise<{
  imported: Product[];
  updated: Product[];
  unchanged: Product[];
  skipped: number;
  variantsImported: ProductVariant[];
  variantsUpdated: ProductVariant[];
  variantsUnchanged: ProductVariant[];
  recipeGroupsImported: number;
  warnings: ImportValidationError[];
}> {
  const rows = Array.isArray(input) ? input : input.rows;
  const variants = Array.isArray(input) ? [] : input.variants;
  const recipes = Array.isArray(input) ? [] : input.recipes;
  const warnings = Array.isArray(input) ? [] : [...input.warnings];
  const activity = await getBusinessActivitySettings();
  const importVariants = activity.enable_variants ? variants : [];
  const importRecipes =
    activity.activity_type === "supermarket" ||
    activity.activity_type === "retail" ||
    activity.activity_type === "wholesale" ||
    activity.activity_type === "mixed"
      ? []
      : recipes;

  if (!activity.enable_variants && variants.length > 0) {
    warnings.push({
      row: 0,
      field: "Variants",
      message:
        "النشاط الحالي بدون أحجام/خيارات؛ شيت Variants هيتجاهل. عدّل المنتجات مباشرة في ورقة المنتجات.",
    });
  }

  if (
    recipes.length > 0 &&
    importRecipes.length === 0 &&
    (activity.activity_type === "supermarket" ||
      activity.activity_type === "retail" ||
      activity.activity_type === "wholesale" ||
      activity.activity_type === "mixed")
  ) {
    warnings.push({
      row: 0,
      field: "Recipes",
      message: "النشاط الحالي بدون وصفات؛ شيت Recipes هيتجاهل.",
    });
  }

  if (activity.activity_type === "supermarket") {
    for (const row of rows) {
      const unit = row.unit.toLowerCase();
      const isWeight =
        definitionKey(row.definition) === "supermarket_weight_product" ||
        unit === "kg" ||
        unit === "gram";
      if (isWeight && !row.allow_price_input.trim()) {
        row.allow_price_input = "true";
      }
      if (
        (unit === "kg" || unit === "gram") &&
        (!row.sales_unit_type || row.sales_unit_type === "piece")
      ) {
        row.sales_unit_type = "weight";
      }
    }
  }

  await assertPeriodOpen(storeId);
  const existing = await productService.listProducts();
  const existingBySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]));
  const imported: Product[] = [];
  const updated: Product[] = [];
  const unchanged: Product[] = [];
  let skipped = 0;

  const categories = await productService.listCategories();
  const defaultCategoryId =
    categories[0]?.id ??
    (await resolveCategoryId("General", createdBy));

  for (const row of rows) {
    const action = row.import_action as ImportAction;
    if (!row.name && !isDeactivateAction(action)) {
      skipped += 1;
      continue;
    }
    const existingProduct = row.sku ? existingBySku.get(row.sku.toLowerCase()) : undefined;

    if (existingProduct) {
      if (action === "create") {
        skipped += 1;
        warnings.push({
          row: 0,
          field: "import_action",
          message: `Product ${row.sku} skipped because it already exists and action is create`,
        });
        continue;
      }
      if (isDeactivateAction(action)) {
        if (!existingProduct.is_active) {
          unchanged.push(existingProduct);
          continue;
        }
        const product = await productService.updateProduct(
          existingProduct.id,
          { is_active: false },
          createdBy
        );
        if (product) updated.push(product);
        continue;
      }
      const categoryId = row.category
        ? await resolveCategoryId(row.category, createdBy)
        : defaultCategoryId;
      const payload = rowToProductInput({ ...row, category_id: categoryId });
      if (productMatchesPayload(existingProduct, payload)) {
        unchanged.push(existingProduct);
        continue;
      }
      const product = await productService.updateProduct(existingProduct.id, payload, createdBy);
      if (product) updated.push(product);
      continue;
    }

    if (action === "update" || isDeactivateAction(action)) {
      skipped += 1;
      warnings.push({
        row: 0,
        field: "sku",
        message: `Product ${row.sku || row.name} skipped because it was not found`,
      });
      continue;
    }

    const categoryId = row.category
      ? await resolveCategoryId(row.category, createdBy)
      : defaultCategoryId;
    const payload = rowToProductInput({ ...row, category_id: categoryId });
    const product = await productService.createProduct(payload, createdBy);
    if (product.sku) existingBySku.set(product.sku.toLowerCase(), product);
    imported.push(product);
  }

  const productBySku = new Map(existingBySku);
  for (const product of [...imported, ...updated]) {
    if (product.sku) productBySku.set(product.sku.toLowerCase(), product);
  }

  const variantsImported: ProductVariant[] = [];
  const variantsUpdated: ProductVariant[] = [];
  const variantsUnchanged: ProductVariant[] = [];
  const variantByProductAndSku = new Map<string, ProductVariant>();
  if (importVariants.length > 0 || importRecipes.length > 0) {
    for (const product of productBySku.values()) {
      const productVariants = await variantService.listVariants(product.id);
      for (const variant of productVariants) {
        if (variant.sku) {
          variantByProductAndSku.set(`${product.id}::${variant.sku.toLowerCase()}`, variant);
        }
      }
    }
  }

  for (const row of importVariants) {
    const product = productBySku.get(row.product_sku.toLowerCase());
    if (!product) {
      skipped += 1;
      warnings.push({
        row: 0,
        field: "product_sku",
        message: `Variant skipped because product SKU ${row.product_sku} was not found`,
      });
      continue;
    }

    const sku = row.variant_sku || buildGeneratedVariantSku(product.sku, row.variant_name);
    const action = row.import_action as ImportAction;
    const payload: Omit<ProductVariant, "id" | "product_id"> = {
      name: row.variant_name || sku,
      sku,
      barcode: row.barcode || sku,
      price_delta: 0,
      price: Number(row.price) || 0,
      image_url: null,
      is_active: parseBool(row.is_active, true),
      variant_kind: "standard",
      quantity_value: null,
      quantity_unit: null,
      price_mode: "fixed_price",
      fixed_price: Number(row.price) || 0,
    };
    const existingVariant = variantByProductAndSku.get(`${product.id}::${sku.toLowerCase()}`);
    if (existingVariant) {
      if (action === "create") {
        skipped += 1;
        warnings.push({
          row: 0,
          field: "import_action",
          message: `Variant ${sku} skipped because it already exists and action is create`,
        });
        continue;
      }
      if (isDeactivateAction(action)) {
        if (!existingVariant.is_active) {
          variantsUnchanged.push(existingVariant);
          continue;
        }
        const updatedVariant = await variantService.updateVariant(
          existingVariant.id,
          { is_active: false },
          createdBy
        );
        variantsUpdated.push(updatedVariant);
        variantByProductAndSku.set(`${product.id}::${sku.toLowerCase()}`, updatedVariant);
        continue;
      }
      if (variantMatchesPayload(existingVariant, payload)) {
        variantsUnchanged.push(existingVariant);
        continue;
      }
      const updatedVariant = await variantService.updateVariant(existingVariant.id, payload, createdBy);
      variantsUpdated.push(updatedVariant);
      variantByProductAndSku.set(`${product.id}::${sku.toLowerCase()}`, updatedVariant);
    } else {
      if (action === "update" || isDeactivateAction(action)) {
        skipped += 1;
        warnings.push({
          row: 0,
          field: "variant_sku",
          message: `Variant ${sku} skipped because it was not found`,
        });
        continue;
      }
      const createdVariant = await variantService.createVariant(product.id, payload, createdBy);
      variantsImported.push(createdVariant);
      variantByProductAndSku.set(`${product.id}::${sku.toLowerCase()}`, createdVariant);
    }
  }

  const productsWithImportedVariants = new Set(
    variants
      .map((variant) => productBySku.get(variant.product_sku.toLowerCase())?.id)
      .filter((id): id is string => Boolean(id))
  );
  for (const productId of productsWithImportedVariants) {
    const allVariants = [...variantByProductAndSku.values()].filter(
      (variant) => variant.product_id === productId && variant.is_active
    );
    const prices = allVariants
      .map((variant) => variant.price ?? variant.fixed_price)
      .filter((price): price is number => typeof price === "number");
    if (prices.length > 0) {
      await productService.updateProduct(
        productId,
        { base_price: Math.min(...prices), sale_price: null },
        createdBy
      );
    }
  }

  const ingredientProducts = [...productBySku.values()].filter(recipeService.canProductBeRecipeIngredient);
  const ingredientBySku = new Map(
    ingredientProducts.filter((p) => p.sku).map((p) => [p.sku.toLowerCase(), p])
  );
  const recipeGroups = new Map<
    string,
    {
      product: Product;
      variant: ProductVariant;
      lines: { ingredient_product_id: string; quantity: number; unit: MeasurementUnit }[];
    }
  >();

  for (const row of importRecipes) {
    const product = productBySku.get(row.product_sku.toLowerCase());
    if (!product) {
      warnings.push({
        row: 0,
        field: "product_sku",
        message: `Recipe skipped because product SKU ${row.product_sku} was not found`,
      });
      continue;
    }
    const variant = variantByProductAndSku.get(`${product.id}::${row.variant_sku.toLowerCase()}`);
    if (!variant) {
      warnings.push({
        row: 0,
        field: "variant_sku",
        message: `Recipe skipped because variant SKU ${row.variant_sku} was not found`,
      });
      continue;
    }
    const ingredient = ingredientBySku.get(row.ingredient_sku.toLowerCase());
    if (!ingredient) {
      warnings.push({
        row: 0,
        field: "ingredient_sku",
        message: `Recipe line skipped because ingredient SKU ${row.ingredient_sku} was not found`,
      });
      continue;
    }
    const key = `${product.id}::${variant.id}`;
    const group = recipeGroups.get(key) ?? { product, variant, lines: [] };
    group.lines.push({
      ingredient_product_id: ingredient.id,
      quantity: Number(row.quantity),
      unit: row.unit as MeasurementUnit,
    });
    recipeGroups.set(key, group);
  }

  let recipeGroupsImported = 0;
  for (const group of recipeGroups.values()) {
    await recipeService.saveRecipe(group.product.id, group.lines, createdBy, group.variant.id);
    recipeGroupsImported += 1;
  }

  const job = await importRepo.createImportJob({
    type: "products",
    status: "completed",
    file_url: null,
    result: {
      imported: imported.length,
      updated: updated.length,
      unchanged: unchanged.length,
      skipped,
      variants_imported: variantsImported.length,
      variants_updated: variantsUpdated.length,
      variants_unchanged: variantsUnchanged.length,
      recipe_groups_imported: recipeGroupsImported,
      warnings: warnings.length,
      created_by: createdBy,
    },
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
    metadata: {
      imported: imported.length,
      updated: updated.length,
      unchanged: unchanged.length,
      skipped,
      variantsImported: variantsImported.length,
      variantsUpdated: variantsUpdated.length,
      variantsUnchanged: variantsUnchanged.length,
      recipeGroupsImported,
      warnings: warnings.length,
    },
  });

  return {
    imported,
    updated,
    unchanged,
    skipped,
    variantsImported,
    variantsUpdated,
    variantsUnchanged,
    recipeGroupsImported,
    warnings,
  };
}
