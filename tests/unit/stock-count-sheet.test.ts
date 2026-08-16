import { describe, expect, it } from "vitest";
import {
  COUNT_SHEET_MAX_ROWS,
  buildCountSheetLines,
  countSheetTotals,
  filterTrackedProducts,
  groupCountSheetLines,
} from "@/modules/stock-count/lib/count-sheet";
import { clampCountedQty, nextCountedQty, openingCountedQty, shouldHealEmptyCountLines } from "@/modules/stock-count/lib/counted-qty";
import { canPrintStockCount } from "@/lib/constants";
import type { Category, Product } from "@/lib/types";

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    org_id: "org",
    name: "شاي",
    sku: "TEA-1",
    barcode: "6220001",
    category_id: "cat-tea",
    base_price: 10,
    description: "",
    sale_price: null,
    image_url: null,
    is_active: true,
    is_popular: false,
    track_inventory: true,
    product_type: "finished",
    unit: "piece",
    last_unit_cost: 5,
    cost_unit: "piece",
    updated_at: new Date().toISOString(),
    ...overrides,
  }) as Product;

const categories: Category[] = [
  {
    id: "cat-tea",
    org_id: "org",
    name: "مشروبات",
    sort_order: 1,
    color: "#000",
    icon: "",
  },
  {
    id: "cat-food",
    org_id: "org",
    name: "أكل",
    sort_order: 2,
    color: "#000",
    icon: "",
  },
];

describe("counted qty", () => {
  it("clamps negative and non-finite values", () => {
    expect(clampCountedQty(-3)).toBe(0);
    expect(clampCountedQty(Number.NaN)).toBe(0);
    expect(nextCountedQty(2, 1)).toBe(3);
    expect(nextCountedQty(0, -1)).toBe(0);
  });

  it("opens scanner counts at zero with a negative variance", () => {
    expect(openingCountedQty(12, true)).toEqual({ countedQty: 0, variance: -12 });
    expect(openingCountedQty(12, false)).toEqual({ countedQty: 12, variance: 0 });
  });

  it("heals only empty counts so a category count stays scoped", () => {
    expect(shouldHealEmptyCountLines(0)).toBe(true);
    expect(shouldHealEmptyCountLines(4)).toBe(false);
  });
});

describe("count sheet filters", () => {
  const products = [
    makeProduct(),
    makeProduct({
      id: "p2",
      name: "سكر",
      barcode: "6220002",
      category_id: "cat-food",
      sku: "SUG-1",
    }),
    makeProduct({
      id: "p3",
      name: "خدمة",
      track_inventory: false,
      barcode: "6220003",
    }),
  ];

  it("drops untracked products and can filter by category or product", () => {
    expect(filterTrackedProducts(products, {}).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(
      filterTrackedProducts(products, { categoryId: "cat-food" }).map((p) => p.id)
    ).toEqual(["p2"]);
    expect(
      filterTrackedProducts(products, { productId: "p1" }).map((p) => p.id)
    ).toEqual(["p1"]);
  });

  it("builds a blank counted sheet grouped by category", () => {
    const qty = new Map([
      ["p1", 8],
      ["p2", 2],
    ]);
    const { lines, truncated } = buildCountSheetLines({
      products,
      categories,
      qtyByProductId: qty,
      filters: {},
      blankCounted: true,
    });
    expect(truncated).toBe(false);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.countedQty === null)).toBe(true);
    const groups = groupCountSheetLines(lines);
    expect(groups.map((g) => g.categoryName).sort()).toEqual(["أكل", "مشروبات"]);
    expect(countSheetTotals(lines)).toMatchObject({
      products: 2,
      systemUnits: 10,
      countedUnits: null,
    });
  });

  it("marks overflow when the catalog exceeds the print cap", () => {
    const many = Array.from({ length: COUNT_SHEET_MAX_ROWS + 3 }, (_, i) =>
      makeProduct({ id: `p${i}`, name: `صنف ${i}`, barcode: `b${i}` })
    );
    const { lines, truncated } = buildCountSheetLines({
      products: many,
      categories,
      qtyByProductId: new Map(),
      filters: {},
      blankCounted: true,
    });
    expect(truncated).toBe(true);
    expect(lines).toHaveLength(COUNT_SHEET_MAX_ROWS);
  });
});

describe("canPrintStockCount", () => {
  it("lets inventory operators print count sheets without reports_print", () => {
    expect(canPrintStockCount("inventory")).toBe(true);
    expect(canPrintStockCount("cashier")).toBe(false);
    expect(canPrintStockCount("cashier", new Set(["stock_count_manage"]))).toBe(
      true
    );
    expect(canPrintStockCount("owner")).toBe(true);
  });
});
