import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  convertPurchaseEntryToBase,
  convertQuantityForPricing,
  productHasPurchasePacking,
  productPurchaseFactor,
} from "@/lib/units";
import { buildProductsTemplateWorkbook } from "@/modules/imports-exports/services/export.service";
import {
  PRODUCT_IMPORT_SUPERMARKET_COLUMNS,
  parseProductsXlsx,
} from "@/modules/imports-exports/services/import.service";

describe("purchase pack conversion", () => {
  it("converts pricing qty piece ↔ carton via purchase packing", () => {
    const packing = {
      baseUnit: "piece" as const,
      packUnit: "carton" as const,
      unitsPerPack: 24,
    };
    expect(
      convertQuantityForPricing({
        quantity: 48,
        from: "piece",
        to: "carton",
        packing,
      })
    ).toBe(2);
    expect(
      convertQuantityForPricing({
        quantity: 2,
        from: "carton",
        to: "piece",
        packing,
      })
    ).toBe(48);
  });

  it("converts carton entry into base pieces and unit cost", () => {
    const result = convertPurchaseEntryToBase({
      quantity: 2,
      unitCost: 120,
      entryUnit: "carton",
      baseUnit: "piece",
      purchaseUnit: "carton",
      unitsPerPurchaseUnit: 24,
    });
    expect(result.quantity).toBe(48);
    expect(result.unitCost).toBe(5);
    expect(result.lineTotal).toBe(240);
  });

  it("converts weight pack entry into base kg and unit cost", () => {
    const result = convertPurchaseEntryToBase({
      quantity: 4,
      unitCost: 100,
      entryUnit: "carton",
      baseUnit: "kg",
      purchaseUnit: "carton",
      unitsPerPurchaseUnit: 2.5,
    });
    expect(result.quantity).toBe(10);
    expect(result.unitCost).toBe(40);
    expect(result.lineTotal).toBe(400);
  });

  it("keeps piece entry unchanged", () => {
    const result = convertPurchaseEntryToBase({
      quantity: 10,
      unitCost: 5,
      entryUnit: "piece",
      baseUnit: "piece",
      purchaseUnit: "carton",
      unitsPerPurchaseUnit: 24,
    });
    expect(result).toEqual({ quantity: 10, unitCost: 5, lineTotal: 50 });
  });

  it("detects packing from product fields", () => {
    expect(
      productHasPurchasePacking({
        unit: "piece",
        base_unit: "piece",
        cost_unit: "carton",
        units_per_purchase_unit: 24,
      })
    ).toBe(true);
    expect(
      productHasPurchasePacking({
        unit: "kg",
        base_unit: "kg",
        cost_unit: "bag",
        units_per_purchase_unit: 2.5,
      })
    ).toBe(true);
    expect(
      productHasPurchasePacking({
        unit: "kg",
        base_unit: "kg",
        cost_unit: "kg",
        units_per_purchase_unit: 1,
      })
    ).toBe(false);
    expect(productPurchaseFactor({ unit: "piece", cost_unit: "carton", units_per_purchase_unit: 24 })).toBe(
      24
    );
  });
});

describe("activity-aware product import template", () => {
  it("builds supermarket products-only template with piece and weight samples", () => {
    const buffer = buildProductsTemplateWorkbook({
      activity_type: "supermarket",
      enable_variants: false,
    });
    const workbook = XLSX.read(buffer, { type: "array" });
    expect(workbook.SheetNames).toEqual(["Products", "README", "Options"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Products);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(rows[0]!)).toEqual(expect.arrayContaining([...PRODUCT_IMPORT_SUPERMARKET_COLUMNS]));
    expect(rows.some((r) => String(r.definition) === "retail_product")).toBe(true);
    expect(rows.some((r) => String(r.definition) === "supermarket_weight_product")).toBe(true);
    expect(rows.some((r) => Number(r.units_per_purchase_unit) === 24)).toBe(true);
  });

  it("keeps variants and recipes for cafe template", () => {
    const buffer = buildProductsTemplateWorkbook({
      activity_type: "cafe",
      enable_variants: true,
    });
    const workbook = XLSX.read(buffer, { type: "array" });
    expect(workbook.SheetNames).toContain("Variants");
    expect(workbook.SheetNames).toContain("Recipes");
  });

  it("parses Arabic weight definition and packing aliases", () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        "اسم المنتج": "جبنة",
        "كود المنتج": "CHEESE",
        التعريف: "منتج_وزني",
        سعر_الكيلو: 220,
        الوحدة: "kg",
        وحدة_الشراء: "kg",
        قطع_في_الكرتونة: 1,
      },
      {
        "اسم المنتج": "مياه",
        "كود المنتج": "WATER",
        التعريف: "retail_product",
        السعر: 5,
        الوحدة: "piece",
        وحدة_الشراء: "carton",
        قطع_في_الكرتونة: 24,
        الباركود: "123",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "المنتجات");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = parseProductsXlsx(buffer);
    expect(parsed.errors).toEqual([]);
    const cheese = parsed.rows.find((r) => r.sku === "CHEESE");
    const water = parsed.rows.find((r) => r.sku === "WATER");
    expect(cheese?.sales_unit_type).toBe("weight");
    expect(cheese?.allow_price_input).toBe("true");
    expect(water?.cost_unit).toBe("carton");
    expect(water?.units_per_purchase_unit).toBe("24");
  });
});
