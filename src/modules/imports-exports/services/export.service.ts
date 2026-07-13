import * as XLSX from "xlsx";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";
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
import type { BusinessActivitySettings, BusinessActivityType } from "@/lib/types";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_SIMPLE_COLUMNS,
  PRODUCT_IMPORT_SUPERMARKET_COLUMNS,
  PRODUCT_RECIPE_IMPORT_COLUMNS,
  PRODUCT_VARIANT_IMPORT_COLUMNS,
} from "./import.service";

type TemplateGroup = "kitchen" | "supermarket" | "shelf";

function templateGroupFor(activityType: BusinessActivityType): TemplateGroup {
  if (activityType === "supermarket") return "supermarket";
  if (
    activityType === "cafe" ||
    activityType === "ice_cream" ||
    activityType === "juice_bar" ||
    activityType === "restaurant"
  ) {
    return "kitchen";
  }
  return "shelf";
}

function kitchenSamples(activityType: BusinessActivityType) {
  const drinkName =
    activityType === "ice_cream"
      ? "Vanilla Scoop"
      : activityType === "juice_bar"
        ? "Orange Juice"
        : activityType === "restaurant"
          ? "Chicken Meal"
          : "Latte";
  const drinkSku =
    activityType === "ice_cream"
      ? "VANILLA"
      : activityType === "juice_bar"
        ? "OJ"
        : activityType === "restaurant"
          ? "CHICKEN"
          : "LATTE";
  return {
    products: [
      {
        name: drinkName,
        sku: drinkSku,
        category: activityType === "restaurant" ? "Meals" : "Hot drinks",
        definition: "menu_item",
        base_price: "",
        barcode: "",
        unit: "piece",
        track_inventory: false,
        import_action: "upsert",
      },
      {
        name: activityType === "restaurant" ? "Chicken" : "Milk",
        sku: activityType === "restaurant" ? "CHICK-RAW" : "MILK",
        category: "Ingredients",
        definition: "ingredient",
        base_price: 38,
        barcode: "",
        unit: "kg",
        track_inventory: true,
        import_action: "upsert",
      },
      {
        name: activityType === "restaurant" ? "Rice" : "Espresso Shot",
        sku: activityType === "restaurant" ? "RICE" : "ESPRESSO",
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
    ],
    variants: [
      {
        product_sku: drinkSku,
        variant_name: "Small",
        variant_sku: `${drinkSku}-S`,
        barcode: "",
        price: 45,
        is_active: true,
        import_action: "upsert",
      },
      {
        product_sku: drinkSku,
        variant_name: "Medium",
        variant_sku: `${drinkSku}-M`,
        barcode: "",
        price: 55,
        is_active: true,
        import_action: "upsert",
      },
      {
        product_sku: drinkSku,
        variant_name: "Large",
        variant_sku: `${drinkSku}-L`,
        barcode: "",
        price: 70,
        is_active: true,
        import_action: "upsert",
      },
    ],
    recipes: [
      {
        product_sku: drinkSku,
        variant_sku: `${drinkSku}-S`,
        ingredient_sku: activityType === "restaurant" ? "CHICK-RAW" : "MILK",
        quantity: 0.18,
        unit: activityType === "restaurant" ? "kg" : "liter",
      },
      {
        product_sku: drinkSku,
        variant_sku: `${drinkSku}-S`,
        ingredient_sku: activityType === "restaurant" ? "RICE" : "ESPRESSO",
        quantity: 0.15,
        unit: "kg",
      },
    ],
  };
}

function supermarketSamples() {
  return [
    {
      name: "ماء معدني",
      sku: "WATER-600",
      barcode: "6224000000001",
      category: "مشروبات",
      definition: "retail_product",
      base_price: 5,
      last_unit_cost: 3.5,
      unit: "piece",
      cost_unit: "carton",
      units_per_purchase_unit: 24,
      track_inventory: true,
      import_action: "upsert",
    },
    {
      name: "جبنة رومي",
      sku: "CHEESE-KG",
      barcode: "6224000000002",
      category: "ألبان",
      definition: "supermarket_weight_product",
      base_price: 220,
      last_unit_cost: 180,
      unit: "kg",
      cost_unit: "kg",
      units_per_purchase_unit: 1,
      track_inventory: true,
      import_action: "upsert",
    },
  ];
}

function shelfSamples() {
  return [
    {
      name: "منتج رف",
      sku: "SHELF-001",
      category: "عام",
      definition: "retail_product",
      base_price: 25,
      barcode: "100001",
      unit: "piece",
      track_inventory: true,
      import_action: "upsert",
    },
  ];
}

export function buildProductsTemplateWorkbook(
  settings: Pick<BusinessActivitySettings, "activity_type" | "enable_variants">
): ArrayBuffer {
  const group = templateGroupFor(settings.activity_type);
  const workbook = XLSX.utils.book_new();

  if (group === "supermarket") {
    const header = [...PRODUCT_IMPORT_SUPERMARKET_COLUMNS];
    const sample = supermarketSamples();
    const sheet = XLSX.utils.json_to_sheet(sample, { header });
    sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
    XLSX.utils.book_append_sheet(workbook, buildReadmeSheet(group, settings.activity_type), "README");
    XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
    return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  }

  if (group === "kitchen") {
    const header = [...PRODUCT_IMPORT_SIMPLE_COLUMNS];
    const samples = kitchenSamples(settings.activity_type);
    const sheet = XLSX.utils.json_to_sheet(samples.products, { header });
    sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
    XLSX.utils.book_append_sheet(workbook, buildVariantsSheet(samples.variants), "Variants");
    XLSX.utils.book_append_sheet(workbook, buildRecipesSheet(samples.recipes), "Recipes");
    XLSX.utils.book_append_sheet(workbook, buildReadmeSheet(group, settings.activity_type), "README");
    XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
    return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  }

  const header = [...PRODUCT_IMPORT_SIMPLE_COLUMNS];
  const sheet = XLSX.utils.json_to_sheet(shelfSamples(), { header });
  sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  if (settings.enable_variants) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildVariantsSheet([
        {
          product_sku: "SHELF-001",
          variant_name: "Default",
          variant_sku: "SHELF-001-D",
          barcode: "",
          price: 25,
          is_active: true,
          import_action: "upsert",
        },
      ]),
      "Variants"
    );
  }
  XLSX.utils.book_append_sheet(workbook, buildReadmeSheet(group, settings.activity_type), "README");
  XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildVariantsSheet(rows: Record<string, string | number | boolean>[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_VARIANT_IMPORT_COLUMNS] });
  sheet["!cols"] = PRODUCT_VARIANT_IMPORT_COLUMNS.map((name) => ({
    wch: Math.max(name.length + 2, 16),
  }));
  return sheet;
}

function buildRecipesSheet(rows: Record<string, string | number | boolean>[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_RECIPE_IMPORT_COLUMNS] });
  sheet["!cols"] = PRODUCT_RECIPE_IMPORT_COLUMNS.map((name) => ({
    wch: Math.max(name.length + 2, 18),
  }));
  return sheet;
}

function buildReadmeSheet(group: TemplateGroup, activityType: BusinessActivityType): XLSX.WorkSheet {
  if (group === "supermarket") {
    return XLSX.utils.aoa_to_sheet([
      ["Velora supermarket product import"],
      ["Products sheet only — no Variants or Recipes for supermarket."],
      ["definition", "retail_product for piece shelf items; supermarket_weight_product for kg items"],
      ["base_price", "Sell price (piece) or sell price per kg (weight) — سعر البيع / سعر الكيلو"],
      ["last_unit_cost", "Purchase cost per sale unit — سعر الشراء"],
      ["cost_unit + units_per_purchase_unit", "Purchase carton/pack: e.g. cost_unit=carton and units_per_purchase_unit=24"],
      ["Arabic headers", "اسم المنتج، باركود، سعر، سعر_الشراء، الوحدة، وحدة_الشراء، قطع_في_الكرتونة"],
      ["Purchases", "Buy by piece or carton on purchase invoices; stock stays in piece/base unit"],
      ["activity", activityType],
    ]);
  }
  if (group === "shelf") {
    return XLSX.utils.aoa_to_sheet([
      ["Velora retail product import"],
      ["Use Products sheet. Variants optional when activity enables sizes."],
      ["definition", "retail_product for tracked shelf items"],
      ["activity", activityType],
    ]);
  }
  return XLSX.utils.aoa_to_sheet([
    ["Velora kitchen product import template"],
    ["Use Products, Variants, and Recipes sheets. Keep header rows unchanged."],
    ["Required columns", "name"],
    ["SKU", "Optional for standalone products. Required when the product is referenced from Variants or Recipes."],
    ["Menu items", "Put sizes and selling prices in Variants. base_price can stay blank for menu items with sizes."],
    ["Recipes", "Optional. Missing recipes import as warnings only; profit and inventory deduction stay zero until recipes are added."],
    ["Updating", "Export current catalog, edit rows, then re-upload the same file. Matching SKUs upsert."],
    ["Cancel", "Use import_action cancel or deactivate with product SKU or variant SKU."],
    ["definition", "Optional. Blank means menu_item. Use ingredient, service, or retail_product only when needed."],
    ["Variants sheet", "Selling prices for sizes live here."],
    ["Arabic headers", "Products: اسم المنتج، كود المنتج، التصنيف، التعريف، السعر، الباركود، الوحدة، تتبع المخزون."],
    ["activity", activityType],
  ]);
}

function buildOptionsSheet(): XLSX.WorkSheet {
  const rows = [
    ["field", "allowed_values"],
    [
      "definition",
      "menu_item, retail_product, supermarket_weight_product, ingredient, service",
    ],
    ["import_action", "upsert, create, update, cancel, deactivate"],
    ["product_type", PRODUCT_TYPES.join(", ")],
    ["sales_unit_type", PRODUCT_SALES_UNIT_TYPES.join(", ")],
    ["unit/base_unit/sale_unit/cost_unit", MEASUREMENT_UNITS.join(", ")],
    ["units_per_purchase_unit", "Number of base units inside one cost_unit (e.g. 24)"],
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
  const [products, categories, businessActivity] = await Promise.all([
    productService.listProducts(),
    productService.listCategories(),
    import("@/modules/system/services/settings.service").then((m) =>
      m.getBusinessActivitySettings()
    ),
  ]);
  const group = templateGroupFor(businessActivity.activity_type);
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantMap = await catalogRepo.listVariantsForProducts(products.map((p) => p.id));

  const productRows = products.map((p) => ({
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: categoryById.get(p.category_id) ?? "",
    definition:
      p.product_type === "ingredient" || p.product_type === "raw_material"
        ? "ingredient"
        : p.product_type === "service"
          ? "service"
          : p.sales_unit_type === "weight" || p.supports_weight_sale
            ? "supermarket_weight_product"
            : p.track_inventory
              ? "retail_product"
              : "menu_item",
    base_price: p.base_price,
    last_unit_cost: p.last_unit_cost ?? 0,
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
    units_per_purchase_unit: p.units_per_purchase_unit ?? 1,
  }));

  const workbook = XLSX.utils.book_new();

  if (group === "supermarket") {
    const supermarketRows = productRows.map((row) => {
      const slim: Record<string, string | number | boolean> = {};
      for (const key of PRODUCT_IMPORT_SUPERMARKET_COLUMNS) {
        slim[key] = (row as Record<string, string | number | boolean>)[key] ?? "";
      }
      return slim;
    });
    XLSX.utils.book_append_sheet(
      workbook,
      sheetFromRows(supermarketRows, PRODUCT_IMPORT_SUPERMARKET_COLUMNS),
      "Products"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      buildReadmeSheet("supermarket", businessActivity.activity_type),
      "README"
    );
    XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
    return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  }

  const variantRows: Record<string, string | number | boolean>[] = [];
  const variantSkuById = new Map<string, string>();
  for (const product of products) {
    const variants = variantMap.get(product.id) ?? [];
    for (const variant of variants) {
      if (variant.sku) variantSkuById.set(variant.id, variant.sku);
      variantRows.push({
        product_sku: product.sku,
        variant_name: variant.name,
        variant_sku: variant.sku,
        barcode: variant.barcode ?? "",
        price: variant.price ?? variant.fixed_price ?? "",
        is_active: variant.is_active,
        import_action: "upsert",
      });
    }
  }

  const recipeLinesByKey = await recipeRepo.listAllRecipeLinesByProductKey();
  const recipeRows: Record<string, string | number>[] = [];
  for (const [key, lines] of recipeLinesByKey) {
    const [productId, variantIdRaw] = key.split(":");
    const product = productById.get(productId);
    if (!product?.sku) continue;
    const variantSku =
      variantIdRaw && variantIdRaw.length > 0
        ? (variantSkuById.get(variantIdRaw) ?? "")
        : "";
    for (const line of lines) {
      const ingredient = productById.get(line.ingredient_product_id);
      if (!ingredient?.sku) continue;
      recipeRows.push({
        product_sku: product.sku,
        variant_sku: variantSku,
        ingredient_sku: ingredient.sku,
        quantity: line.quantity,
        unit: line.unit,
      });
    }
  }

  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(productRows, PRODUCT_IMPORT_COLUMNS),
    "Products"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(variantRows, PRODUCT_VARIANT_IMPORT_COLUMNS),
    "Variants"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(recipeRows, PRODUCT_RECIPE_IMPORT_COLUMNS),
    "Recipes"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildReadmeSheet(group, businessActivity.activity_type),
    "README"
  );
  XLSX.utils.book_append_sheet(workbook, buildOptionsSheet(), "Options");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function sheetFromRows(
  rows: Record<string, string | number | boolean>[],
  headers: readonly string[]
): XLSX.WorkSheet {
  const sheet =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows, { header: [...headers] })
      : XLSX.utils.aoa_to_sheet([[...headers]]);
  sheet["!cols"] = headers.map((name) => ({
    wch: Math.max(name.length + 2, 16),
  }));
  return sheet;
}

export function workbookToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function templateFilenameForActivity(activityType: BusinessActivityType): string {
  return `Velora-${activityType}-products-template.xlsx`;
}
