import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import {
  applyDisplayDiscount,
  buildPriceListRowFromCost,
  computePackCost,
  reapplyMargin,
  suggestSaleFromCost,
} from "@/modules/price-lists/lib/build-price-list-rows";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    org_id: "o1",
    name: "كاتشب",
    sku: "K1",
    barcode: "123",
    category_id: "c1",
    base_price: 24,
    description: "",
    sale_price: null,
    image_url: null,
    is_active: true,
    is_popular: false,
    track_inventory: true,
    product_type: "finished",
    unit: "piece",
    base_unit: "piece",
    last_unit_cost: 5,
    cost_unit: "carton",
    units_per_purchase_unit: 24,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("wholesale price list rows", () => {
  it("reconstructs carton pack cost from base unit cost", () => {
    const baseCost = 1052 / 24;
    expect(computePackCost(product(), baseCost)).toBe(1052);
  });

  it("suggests from cost when catalog sale price is missing", () => {
    expect(suggestSaleFromCost(1052, 2.6616)).toBe(1080);
  });

  it("uses catalog سعر البيع as the list price when present", () => {
    const row = buildPriceListRowFromCost({
      id: "l1",
      product: product({ base_price: 24, sale_price: null }),
      unitCost: 1052 / 24,
      landedUnitCost: 1052 / 24,
      marginPercent: 5,
    });
    expect(row.hasPacking).toBe(true);
    expect(row.packCost).toBe(1052);
    expect(row.catalogSalePrice).toBe(24);
    expect(row.salePrice).toBe(24);
    expect(row.packUnitLabel).toBe("قطعة");
  });

  it("falls back to cost + margin when catalog sale price is zero", () => {
    const row = buildPriceListRowFromCost({
      id: "l1",
      product: product({ base_price: 0, sale_price: null }),
      unitCost: 1052 / 24,
      landedUnitCost: 1052 / 24,
      marginPercent: 5,
    });
    expect(row.salePrice).toBe(suggestSaleFromCost(1052, 5));
  });

  it("keeps catalog sale price when reapplying margin", () => {
    const row = buildPriceListRowFromCost({
      id: "l1",
      product: product({ base_price: 24 }),
      unitCost: 10,
      marginPercent: 5,
    });
    const next = reapplyMargin([row], 20, new Set());
    expect(next[0]?.salePrice).toBe(24);
  });

  it("keeps manual sale price when reapplying margin", () => {
    const row = buildPriceListRowFromCost({
      id: "l1",
      product: product({ base_price: 0 }),
      unitCost: 10,
      marginPercent: 5,
      salePriceOverride: 1080,
    });
    const next = reapplyMargin([row], 10, new Set(["l1"]));
    expect(next[0]?.salePrice).toBe(1080);
  });

  it("applies display discount on sale price", () => {
    expect(applyDisplayDiscount(100, 10)).toBe(90);
  });
});
