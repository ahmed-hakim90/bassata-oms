import * as XLSX from "xlsx";
import * as productService from "@/modules/products/services/product.service";
import {
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  MEASUREMENT_UNITS,
  PRODUCT_SALES_UNIT_TYPES,
  PRODUCT_TYPES,
  SHELF_LIFE_UNITS,
} from "@/lib/constants";
import { PRODUCT_IMPORT_COLUMNS } from "./import.service";

async function categoryName(categoryId: string): Promise<string> {
  const categories = await productService.listCategories();
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

export function buildProductsTemplateWorkbook(): ArrayBuffer {
  const header = [...PRODUCT_IMPORT_COLUMNS];
  const sample = [
    {
      name: "Retail Bottle",
      sku: "RTL-001",
      barcode: "622100001",
      category: "Beverages",
      base_price: 18,
      sale_price: 25,
      description: "Ready-to-sell menu item",
      image_url: "",
      import_action: "upsert",
      product_type: "finished_product",
      sales_unit_type: "piece",
      unit: "piece",
      base_unit: "piece",
      sale_unit: "piece",
      cost_unit: "piece",
      is_active: true,
      is_popular: false,
      track_inventory: true,
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_tracking_enabled: false,
      expiry_policy: "warn_only",
      shelf_life_value: 0,
      shelf_life_unit: "days",
      allow_fractional_quantity: false,
      allow_price_input: false,
      wholesale_enabled: false,
      supports_weight_sale: false,
      supports_amount_sale: false,
    },
    {
      name: "Beef by KG",
      sku: "BEEF-KG",
      barcode: "622200001",
      category: "Butcher",
      base_price: 320,
      sale_price: 350,
      description: "Weighted product sold by kg or customer amount",
      image_url: "",
      import_action: "upsert",
      product_type: "finished_product",
      sales_unit_type: "weight",
      unit: "kg",
      base_unit: "kg",
      sale_unit: "kg",
      cost_unit: "kg",
      is_active: true,
      is_popular: false,
      track_inventory: true,
      inventory_tracking_mode: "batch_and_expiry",
      inventory_rotation_method: "FEFO",
      expiry_tracking_enabled: true,
      expiry_policy: "block_sale",
      shelf_life_value: 5,
      shelf_life_unit: "days",
      allow_fractional_quantity: true,
      allow_price_input: true,
      wholesale_enabled: true,
      supports_weight_sale: true,
      supports_amount_sale: true,
    },
    {
      name: "Delivery Service",
      sku: "SVC-DEL",
      barcode: "SVC-DEL",
      category: "Services",
      base_price: 0,
      sale_price: 20,
      description: "Service without inventory tracking",
      image_url: "",
      import_action: "upsert",
      product_type: "service",
      sales_unit_type: "piece",
      unit: "piece",
      base_unit: "piece",
      sale_unit: "piece",
      cost_unit: "piece",
      is_active: true,
      is_popular: false,
      track_inventory: false,
      inventory_tracking_mode: "none",
      inventory_rotation_method: "FIFO",
      expiry_tracking_enabled: false,
      expiry_policy: "warn_only",
      shelf_life_value: 0,
      shelf_life_unit: "days",
      allow_fractional_quantity: false,
      allow_price_input: false,
      wholesale_enabled: false,
      supports_weight_sale: false,
      supports_amount_sale: false,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample, { header });
  sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  XLSX.utils.book_append_sheet(workbook, buildReadmeSheet(), "README");
  XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildReadmeSheet(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ["CafeFlow product import template"],
    ["Use the Products sheet for upload. Keep the header row unchanged."],
    ["Required columns", "name, sku, category, base_price"],
    ["import_action", "upsert updates an existing SKU or creates it. create skips existing SKUs. update skips missing SKUs."],
    ["Booleans", "Use true/false, yes/no, or 1/0."],
    ["Categories", "A missing category name will be created automatically."],
    ["Options", "See the Options sheet for allowed enum values."],
  ]);
}

function buildOptionsSheet(): XLSX.WorkSheet {
  const rows = [
    ["field", "allowed_values"],
    ["import_action", "upsert, create, update"],
    ["product_type", PRODUCT_TYPES.join(", ")],
    ["sales_unit_type", PRODUCT_SALES_UNIT_TYPES.join(", ")],
    ["unit/base_unit/sale_unit/cost_unit", MEASUREMENT_UNITS.join(", ")],
    ["inventory_tracking_mode", INVENTORY_TRACKING_MODES.join(", ")],
    ["inventory_rotation_method", INVENTORY_ROTATION_METHODS.join(", ")],
    ["expiry_policy", EXPIRY_POLICIES.join(", ")],
    ["shelf_life_unit", SHELF_LIFE_UNITS.join(", ")],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 32 }, { wch: 90 }];
  return sheet;
}

export async function buildProductsExportWorkbook(): Promise<ArrayBuffer> {
  const products = await productService.listProducts();
  const rows = await Promise.all(
    products.map(async (p) => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: await categoryName(p.category_id),
      base_price: p.base_price,
      sale_price: p.sale_price ?? "",
      description: p.description,
      image_url: p.image_url ?? "",
      import_action: "upsert",
      product_type: p.product_type,
      sales_unit_type: p.sales_unit_type ?? "piece",
      unit: p.unit,
      base_unit: p.base_unit ?? p.unit,
      sale_unit: p.sale_unit ?? p.unit,
      cost_unit: p.cost_unit,
      is_active: p.is_active,
      is_popular: p.is_popular,
      track_inventory: p.track_inventory,
      inventory_tracking_mode: p.inventory_tracking_mode ?? "standard",
      inventory_rotation_method: p.inventory_rotation_method ?? "FIFO",
      expiry_tracking_enabled: p.expiry_tracking_enabled ?? false,
      expiry_policy: p.expiry_policy ?? "warn_only",
      shelf_life_value: p.shelf_life_value ?? 0,
      shelf_life_unit: p.shelf_life_unit ?? "days",
      allow_fractional_quantity: p.allow_fractional_quantity ?? false,
      allow_price_input: p.allow_price_input ?? false,
      wholesale_enabled: p.wholesale_enabled ?? false,
      supports_weight_sale: p.supports_weight_sale ?? false,
      supports_amount_sale: p.supports_amount_sale ?? false,
    }))
  );
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_IMPORT_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function workbookToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}
