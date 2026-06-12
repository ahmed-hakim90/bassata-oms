import { describe, expect, it } from "vitest";
import { stockLevelToReorderSuggestion } from "@/modules/inventory/services/reorder.service";
import type { StockLevelView } from "@/modules/inventory/services/stock.service";

const baseLevel: StockLevelView = {
  id: "level-1",
  store_id: "store-1",
  warehouse_id: "warehouse-1",
  product_id: "product-1",
  variant_id: null,
  quantity: 4,
  reorder_point: 10,
  updated_at: new Date().toISOString(),
  product: {
    id: "product-1",
    org_id: "org-1",
    name: "Mango Bag",
    sku: "MANGO",
    barcode: "MANGO",
    category_id: "cat-1",
    base_price: 0,
    description: "",
    sale_price: null,
    updated_at: new Date().toISOString(),
    image_url: null,
    is_active: true,
    is_popular: false,
    track_inventory: true,
    product_type: "ingredient",
    unit: "bag",
    last_unit_cost: 12,
    cost_unit: "bag",
  },
};

describe("stockLevelToReorderSuggestion", () => {
  it("suggests enough quantity to reach twice the reorder point", () => {
    const suggestion = stockLevelToReorderSuggestion(baseLevel, "Main");

    expect(suggestion?.suggestedQuantity).toBe(16);
    expect(suggestion?.estimatedCost).toBe(192);
    expect(suggestion?.priority).toBe("urgent");
  });

  it("uses recent consumption when it exceeds the reorder target", () => {
    const suggestion = stockLevelToReorderSuggestion(baseLevel, "Main", 3);

    expect(suggestion?.suggestedQuantity).toBe(38);
    expect(suggestion?.averageDailyUsage).toBe(3);
    expect(suggestion?.daysCover).toBeCloseTo(1.33, 2);
  });

  it("does not suggest reorder when stock is above reorder point", () => {
    const suggestion = stockLevelToReorderSuggestion(
      { ...baseLevel, quantity: 12 },
      "Main"
    );

    expect(suggestion).toBeNull();
  });
});
