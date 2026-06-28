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
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_SIMPLE_COLUMNS,
  PRODUCT_RECIPE_IMPORT_COLUMNS,
  PRODUCT_VARIANT_IMPORT_COLUMNS,
} from "./import.service";

async function categoryName(categoryId: string): Promise<string> {
  const categories = await productService.listCategories();
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

export function buildProductsTemplateWorkbook(): ArrayBuffer {
  const header = [...PRODUCT_IMPORT_SIMPLE_COLUMNS];
  const sample = [
    {
      name: "Latte",
      sku: "LATTE",
      category: "Hot drinks",
      definition: "menu_item",
      base_price: "",
      barcode: "",
      unit: "piece",
      track_inventory: false,
      import_action: "upsert",
    },
    {
      name: "Milk",
      sku: "MILK",
      category: "Ingredients",
      definition: "ingredient",
      base_price: 38,
      barcode: "",
      unit: "kg",
      track_inventory: true,
      import_action: "upsert",
    },
    {
      name: "Espresso Shot",
      sku: "ESPRESSO",
      category: "Ingredients",
      definition: "ingredient",
      base_price: 160,
      barcode: "",
      unit: "kg",
      track_inventory: true,
      import_action: "upsert",
    },
    {
      name: "Paper Cup",
      sku: "CUP-12",
      category: "Packaging",
      definition: "ingredient",
      base_price: 1.25,
      barcode: "",
      unit: "piece",
      track_inventory: true,
      import_action: "upsert",
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(sample, { header });
  sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  XLSX.utils.book_append_sheet(workbook, buildVariantsSheet(), "Variants");
  XLSX.utils.book_append_sheet(workbook, buildRecipesSheet(), "Recipes");
  XLSX.utils.book_append_sheet(workbook, buildReadmeSheet(), "README");
  XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildVariantsSheet(): XLSX.WorkSheet {
  const rows = [
    {
      product_sku: "LATTE",
      variant_name: "Small",
      variant_sku: "LATTE-S",
      barcode: "",
      price: 45,
      is_active: true,
      import_action: "upsert",
    },
    {
      product_sku: "LATTE",
      variant_name: "Medium",
      variant_sku: "LATTE-M",
      barcode: "",
      price: 55,
      is_active: true,
      import_action: "upsert",
    },
    {
      product_sku: "LATTE",
      variant_name: "Large",
      variant_sku: "LATTE-L",
      barcode: "",
      price: 70,
      is_active: true,
      import_action: "upsert",
    },
    {
      product_sku: "LATTE",
      variant_name: "",
      variant_sku: "LATTE-OLD",
      barcode: "",
      price: "",
      is_active: false,
      import_action: "cancel",
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_VARIANT_IMPORT_COLUMNS] });
  sheet["!cols"] = PRODUCT_VARIANT_IMPORT_COLUMNS.map((name) => ({
    wch: Math.max(name.length + 2, 16),
  }));
  return sheet;
}

function buildRecipesSheet(): XLSX.WorkSheet {
  const rows = [
    { product_sku: "LATTE", variant_sku: "LATTE-S", ingredient_sku: "MILK", quantity: 0.18, unit: "liter" },
    { product_sku: "LATTE", variant_sku: "LATTE-S", ingredient_sku: "ESPRESSO", quantity: 0.018, unit: "kg" },
    { product_sku: "LATTE", variant_sku: "LATTE-S", ingredient_sku: "CUP-12", quantity: 1, unit: "piece" },
    { product_sku: "LATTE", variant_sku: "LATTE-M", ingredient_sku: "MILK", quantity: 0.24, unit: "liter" },
    { product_sku: "LATTE", variant_sku: "LATTE-M", ingredient_sku: "ESPRESSO", quantity: 0.022, unit: "kg" },
    { product_sku: "LATTE", variant_sku: "LATTE-M", ingredient_sku: "CUP-12", quantity: 1, unit: "piece" },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_RECIPE_IMPORT_COLUMNS] });
  sheet["!cols"] = PRODUCT_RECIPE_IMPORT_COLUMNS.map((name) => ({
    wch: Math.max(name.length + 2, 18),
  }));
  return sheet;
}

function buildReadmeSheet(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ["CafeFlow simple product import template"],
    ["Use Products, Variants, and Recipes sheets. Keep header rows unchanged."],
    ["Required columns", "name"],
    ["SKU", "Optional for standalone products. Required when the product is referenced from Variants or Recipes."],
    ["Menu items", "Put sizes and selling prices in Variants. base_price can stay blank for menu items with sizes."],
    ["Recipes", "Optional. Missing recipes import as warnings only; profit and inventory deduction stay zero until recipes are added."],
    ["Updating", "Upload the same SKU again with import_action upsert or update. Rows with no changes are reported as unchanged."],
    ["Cancel", "Use import_action cancel or deactivate with product SKU or variant SKU. This disables the product/size; it does not delete history."],
    ["definition", "Optional. Blank means menu_item. Use ingredient, service, or retail_product only when needed."],
    ["base_price", "Unit cost for ingredients. For simple menu items without variants it can be the selling price."],
    ["Arabic headers", "Products: اسم المنتج، كود المنتج، التصنيف، التعريف، السعر، الباركود، الوحدة، تتبع المخزون."],
    ["Arabic headers", "Variants: كود المنتج، الحجم، كود الحجم، سعر الحجم، الباركود، نشط."],
    ["Arabic headers", "Recipes: كود المنتج، كود الحجم، كود المكون، الكمية، الوحدة."],
    ["Advanced columns", "Existing full templates and exports are still supported."],
  ]);
}

function buildOptionsSheet(): XLSX.WorkSheet {
  const rows = [
    ["field", "allowed_values"],
    ["definition", "menu_item, retail_product, ingredient, service"],
    ["import_action", "upsert, create, update, cancel, deactivate"],
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
      definition:
        p.product_type === "ingredient" || p.product_type === "raw_material"
          ? "ingredient"
          : p.product_type === "service"
            ? "service"
            : p.track_inventory
              ? "retail_product"
              : "menu_item",
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
