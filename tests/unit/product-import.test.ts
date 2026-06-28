import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_SIMPLE_COLUMNS,
  bulkImportProducts,
  parseProductsXlsx,
  validateProductRows,
} from "@/modules/imports-exports/services/import.service";
import * as productService from "@/modules/products/services/product.service";
import * as recipeService from "@/modules/products/services/recipe.service";
import * as variantService from "@/modules/products/services/variant.service";
import * as importRepo from "@/lib/repositories/import.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { Product } from "@/lib/types";

vi.mock("@/modules/products/services/product.service");
vi.mock("@/modules/products/services/recipe.service");
vi.mock("@/modules/products/services/variant.service");
vi.mock("@/lib/repositories/import.repository");
vi.mock("@/lib/repositories/organization.repository");
vi.mock("@/lib/services/audit.service");
vi.mock("@/lib/services/period-lock.service");

function workbookBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_IMPORT_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function simpleWorkbookBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PRODUCT_IMPORT_SIMPLE_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function multiSheetWorkbookBuffer(input: {
  products: Record<string, unknown>[];
  variants?: Record<string, unknown>[];
  recipes?: Record<string, unknown>[];
  variantSheetName?: string;
  recipeSheetName?: string;
}): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  if (input.products.length > 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(input.products, { header: [...PRODUCT_IMPORT_SIMPLE_COLUMNS] }),
      "Products"
    );
  }
  if (input.variants) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(input.variants),
      input.variantSheetName ?? "Variants"
    );
  }
  if (input.recipes) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(input.recipes),
      input.recipeSheetName ?? "Recipes"
    );
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("product import schema", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("parses production product fields from xlsx", () => {
    const parsed = parseProductsXlsx(
      workbookBuffer([
        {
          name: "Beef by KG",
          sku: "BEEF-KG",
          barcode: "2001",
          category: "Butcher",
          base_price: 320,
          sale_price: 350,
          description: "Weighted product",
          image_url: "https://example.com/beef.jpg",
          import_action: "upsert",
          product_type: "finished_product",
          sales_unit_type: "weight",
          unit: "kg",
          base_unit: "kg",
          sale_unit: "kg",
          cost_unit: "kg",
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
      ])
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      product_type: "finished_product",
      sales_unit_type: "weight",
      unit: "kg",
      import_action: "upsert",
      inventory_tracking_mode: "batch_and_expiry",
      allow_price_input: "true",
      wholesale_enabled: "true",
    });
  });

  it("accepts common Arabic headers", () => {
    const parsed = parseProductsXlsx(
      workbookBuffer([
        {
          "اسم المنتج": "قهوة",
          "كود المنتج": "COF-1",
          "التصنيف": "مشروبات",
          "سعر التكلفة": 10,
          "سعر البيع": 15,
          "نشط": true,
        },
      ])
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      name: "قهوة",
      sku: "COF-1",
      category: "مشروبات",
      base_price: "10",
      sale_price: "15",
      is_active: "true",
    });
  });

  it("parses the simple Arabic product definition", () => {
    const parsed = parseProductsXlsx(
      simpleWorkbookBuffer([
        {
          "اسم المنتج": "لاتيه",
          "التصنيف": "مشروبات",
          "التعريف": "عنصر قائمة",
          "السعر": 65,
          "الباركود": "LATTE",
          "الوحدة": "piece",
        },
        {
          "اسم المنتج": "لبن",
          "التصنيف": "مكونات",
          "التعريف": "مكون",
          "السعر": 38,
          "الوحدة": "kg",
        },
      ])
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      name: "لاتيه",
      sku: "",
      definition: "عنصر قائمة",
      base_price: "65",
      product_type: "finished_product",
      track_inventory: "false",
      inventory_tracking_mode: "none",
    });
    expect(parsed.rows[1]).toMatchObject({
      name: "لبن",
      product_type: "ingredient",
      sales_unit_type: "weight",
      allow_fractional_quantity: "true",
      track_inventory: "true",
    });
  });

  it("defaults blank definitions to menu items without inventory tracking", () => {
    const parsed = parseProductsXlsx(
      simpleWorkbookBuffer([
        {
          "اسم المنتج": "شاي",
          "التصنيف": "مشروبات",
          "السعر": 10,
        },
      ])
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      name: "شاي",
      definition: "",
      product_type: "finished_product",
      track_inventory: "false",
      inventory_tracking_mode: "none",
    });
  });

  it("parses Products, Variants, and optional Recipes sheets", () => {
    const parsed = parseProductsXlsx(
      multiSheetWorkbookBuffer({
        products: [
          { name: "Latte", sku: "LATTE", category: "Drinks", definition: "menu_item" },
          { name: "Milk", sku: "MILK", category: "Ingredients", definition: "ingredient", base_price: 38, unit: "liter" },
        ],
        variants: [
          { product_sku: "LATTE", variant_name: "Small", variant_sku: "LATTE-S", price: 45 },
          { product_sku: "LATTE", variant_name: "Large", variant_sku: "LATTE-L", price: 70 },
        ],
        recipes: [
          { product_sku: "LATTE", variant_sku: "LATTE-S", ingredient_sku: "MILK", quantity: 0.18, unit: "liter" },
        ],
      })
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.variants).toHaveLength(2);
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Recipes",
          message: expect.stringContaining("zero cost"),
        }),
      ])
    );
  });

  it("parses Arabic sizes sheet without requiring Products rows", () => {
    const parsed = parseProductsXlsx(
      multiSheetWorkbookBuffer({
        products: [],
        variantSheetName: "الأحجام",
        variants: [
          {
            "كود المنتج": "TEA",
            "الحجم": "كبير",
            "كود الحجم": "TEA-L",
            "سعر الحجم": 18,
          },
        ],
      })
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.variants).toEqual([
      expect.objectContaining({
        product_sku: "TEA",
        variant_name: "كبير",
        variant_sku: "TEA-L",
        price: "18",
      }),
    ]);
  });

  it("validates enum-backed product fields", () => {
    const errors = validateProductRows([
      {
        name: "Broken",
        sku: "BROKEN",
        barcode: "",
        category: "",
        definition: "",
        base_price: "1",
        sale_price: "",
        description: "",
        image_url: "",
        import_action: "replace",
        product_type: "bad",
        sales_unit_type: "crate",
        unit: "piece",
        base_unit: "piece",
        sale_unit: "piece",
        cost_unit: "piece",
        is_active: "true",
        is_popular: "false",
        track_inventory: "true",
        inventory_tracking_mode: "mystery",
        inventory_rotation_method: "LIFO",
        expiry_tracking_enabled: "false",
        expiry_policy: "ignore",
        shelf_life_value: "0",
        shelf_life_unit: "days",
        allow_fractional_quantity: "false",
        allow_price_input: "false",
        wholesale_enabled: "false",
        supports_weight_sale: "",
        supports_amount_sale: "",
      },
    ]);

    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "product_type",
        "import_action",
        "sales_unit_type",
        "inventory_tracking_mode",
        "inventory_rotation_method",
        "expiry_policy",
      ])
    );
  });

  it("upserts by SKU: creates missing rows and updates existing rows", async () => {
    const existing = product("existing-1", "SKU-1", "Old name");
    const created = product("created-1", "SKU-2", "Created");
    const updated = product("existing-1", "SKU-1", "Updated name");

    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(productService.listProducts).mockResolvedValue([existing]);
    vi.mocked(productService.listCategories).mockResolvedValue([
      {
        id: "cat-1",
        org_id: "org-1",
        name: "General",
        sort_order: 1,
        color: "#fff",
        icon: "package",
      },
    ]);
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(productService.updateProduct).mockResolvedValue(updated);
    vi.mocked(importRepo.createImportJob).mockResolvedValue({
      id: "job-1",
      org_id: "org-1",
      type: "products",
      status: "completed",
      file_url: null,
      result: {},
      created_by: "user-1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(orgRepo.getOrgId).mockResolvedValue("org-1");
    vi.mocked(writeAuditLog).mockResolvedValue({
      id: "audit-1",
      org_id: "org-1",
      store_id: "store-1",
      user_id: "user-1",
      action: "import.completed",
      entity_type: "import_job",
      entity_id: "job-1",
      metadata: {},
      created_at: new Date().toISOString(),
    });

    const result = await bulkImportProducts(
      [
        importRow({ sku: "SKU-1", name: "Updated name" }),
        importRow({ sku: "SKU-2", name: "Created" }),
      ],
      "user-1",
      "store-1"
    );

    expect(result.updated).toHaveLength(1);
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(productService.updateProduct).toHaveBeenCalledWith(
      "existing-1",
      expect.objectContaining({ name: "Updated name", sku: "SKU-1" }),
      "user-1"
    );
    expect(productService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Created", sku: "SKU-2" }),
      "user-1"
    );
  });

  it("creates rows without SKU so products can auto-generate codes", async () => {
    const created = product("created-1", "PRD-001", "No SKU");

    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(productService.listProducts).mockResolvedValue([]);
    vi.mocked(productService.listCategories).mockResolvedValue([
      {
        id: "cat-1",
        org_id: "org-1",
        name: "General",
        sort_order: 1,
        color: "#fff",
        icon: "package",
      },
    ]);
    vi.mocked(productService.createProduct).mockResolvedValue(created);
    vi.mocked(importRepo.createImportJob).mockResolvedValue({
      id: "job-1",
      org_id: "org-1",
      type: "products",
      status: "completed",
      file_url: null,
      result: {},
      created_by: "user-1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(orgRepo.getOrgId).mockResolvedValue("org-1");
    vi.mocked(writeAuditLog).mockResolvedValue({
      id: "audit-1",
      org_id: "org-1",
      store_id: "store-1",
      user_id: "user-1",
      action: "import.completed",
      entity_type: "import_job",
      entity_id: "job-1",
      metadata: {},
      created_at: new Date().toISOString(),
    });

    const result = await bulkImportProducts(
      [importRow({ sku: "", name: "No SKU", base_price: "12" })],
      "user-1",
      "store-1"
    );

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(productService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: "No SKU", sku: "", base_price: 12 }),
      "user-1"
    );
  });

  it("imports variants and variant recipes when sheets are present", async () => {
    const latte = product("product-latte", "LATTE", "Latte");
    const milk = product("product-milk", "MILK", "Milk");
    milk.product_type = "ingredient";
    milk.inventory_product_type = "raw_material";
    milk.unit = "liter";
    milk.base_unit = "liter";
    milk.sale_unit = "liter";
    milk.cost_unit = "liter";
    const variant = {
      id: "variant-small",
      product_id: latte.id,
      name: "Small",
      sku: "LATTE-S",
      barcode: "LATTE-S",
      price_delta: 0,
      price: 45,
      image_url: null,
      is_active: true,
      variant_kind: "standard" as const,
      quantity_value: null,
      quantity_unit: null,
      price_mode: "fixed_price" as const,
      fixed_price: 45,
    };

    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(productService.listProducts).mockResolvedValue([latte, milk]);
    vi.mocked(productService.listCategories).mockResolvedValue([
      {
        id: "cat-1",
        org_id: "org-1",
        name: "General",
        sort_order: 1,
        color: "#fff",
        icon: "package",
      },
    ]);
    vi.mocked(productService.updateProduct).mockImplementation(async (id, input) => ({
      ...(id === latte.id ? latte : milk),
      ...input,
    }));
    vi.mocked(variantService.listVariants).mockResolvedValue([]);
    vi.mocked(variantService.createVariant).mockResolvedValue(variant);
    vi.mocked(recipeService.canProductBeRecipeIngredient).mockImplementation(
      (item) => item.product_type === "ingredient" || item.product_type === "raw_material"
    );
    vi.mocked(recipeService.saveRecipe).mockResolvedValue({
      id: "recipe-1",
      org_id: "org-1",
      product_id: latte.id,
      variant_id: variant.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(importRepo.createImportJob).mockResolvedValue({
      id: "job-1",
      org_id: "org-1",
      type: "products",
      status: "completed",
      file_url: null,
      result: {},
      created_by: "user-1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(orgRepo.getOrgId).mockResolvedValue("org-1");
    vi.mocked(writeAuditLog).mockResolvedValue({
      id: "audit-1",
      org_id: "org-1",
      store_id: "store-1",
      user_id: "user-1",
      action: "import.completed",
      entity_type: "import_job",
      entity_id: "job-1",
      metadata: {},
      created_at: new Date().toISOString(),
    });

    const result = await bulkImportProducts(
      {
        rows: [],
        variants: [
          {
            product_sku: "LATTE",
            variant_name: "Small",
            variant_sku: "LATTE-S",
            barcode: "",
            price: "45",
            is_active: "true",
            import_action: "upsert",
          },
        ],
        recipes: [
          {
            product_sku: "LATTE",
            variant_sku: "LATTE-S",
            ingredient_sku: "MILK",
            quantity: "0.18",
            unit: "liter",
          },
        ],
        errors: [],
        warnings: [],
      },
      "user-1",
      "store-1"
    );

    expect(result.variantsImported).toHaveLength(1);
    expect(result.recipeGroupsImported).toBe(1);
    expect(recipeService.saveRecipe).toHaveBeenCalledWith(
      latte.id,
      [{ ingredient_product_id: milk.id, quantity: 0.18, unit: "liter" }],
      "user-1",
      variant.id
    );
  });
});

function importRow(overrides: Partial<Record<(typeof PRODUCT_IMPORT_COLUMNS)[number], string>>) {
  return {
    name: "Product",
    sku: "SKU",
    barcode: "",
    category: "General",
    definition: "",
    base_price: "1",
    sale_price: "",
    description: "",
    image_url: "",
    import_action: "upsert",
    product_type: "finished_product",
    sales_unit_type: "piece",
    unit: "piece",
    base_unit: "piece",
    sale_unit: "piece",
    cost_unit: "piece",
    is_active: "true",
    is_popular: "false",
    track_inventory: "true",
    inventory_tracking_mode: "standard",
    inventory_rotation_method: "FIFO",
    expiry_tracking_enabled: "false",
    expiry_policy: "warn_only",
    shelf_life_value: "0",
    shelf_life_unit: "days",
    allow_fractional_quantity: "false",
    allow_price_input: "false",
    wholesale_enabled: "false",
    supports_weight_sale: "",
    supports_amount_sale: "",
    ...overrides,
  };
}

function product(id: string, sku: string, name: string): Product {
  return {
    id,
    org_id: "org-1",
    name,
    sku,
    barcode: sku,
    category_id: "cat-1",
    base_price: 1,
    description: "",
    sale_price: null,
    image_url: null,
    is_active: true,
    is_popular: false,
    track_inventory: true,
    product_type: "finished_product",
    inventory_product_type: "finished_product",
    inventory_tracking_mode: "standard",
    inventory_rotation_method: "FIFO",
    expiry_policy: "warn_only",
    expiry_tracking_enabled: false,
    shelf_life_value: 0,
    shelf_life_unit: "days",
    unit: "piece",
    sale_unit: "piece",
    base_unit: "piece",
    sales_unit_type: "piece",
    allow_fractional_quantity: false,
    allow_price_input: false,
    wholesale_enabled: false,
    supports_weight_sale: false,
    supports_amount_sale: false,
    last_unit_cost: 0,
    cost_unit: "piece",
    updated_at: new Date().toISOString(),
  };
}
