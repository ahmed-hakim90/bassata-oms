import { describe, it, expect } from "vitest";
import { matchProducts } from "@/modules/products/lib/match-products";
import type { Product } from "@/lib/types";

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: "prod-1",
    org_id: "org-1",
    name: "Test Product",
    description: "",
    barcode: "",
    sku: "",
    unit: "piece",
    base_price: 100,
    sale_price: null,
    last_unit_cost: 50,
    category_id: "c1",
    is_active: true,
    is_popular: false,
    track_inventory: true,
    product_type: "finished",
    cost_unit: "piece",
    image_url: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  }) as Product;

describe("matchProducts", () => {
  it("returns empty array for empty query", () => {
    const products = [makeProduct({ name: "Product 1" })];
    expect(matchProducts(products, "")).toEqual([]);
    expect(matchProducts(products, "   ")).toEqual([]);
  });

  it("returns exact barcode match with priority", () => {
    const products = [
      makeProduct({ id: "1", name: "Product 1", barcode: "12345" }),
      makeProduct({ id: "2", name: "Product 12345", barcode: "" }),
    ];
    const result = matchProducts(products, "12345");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("returns exact SKU match with priority", () => {
    const products = [
      makeProduct({ id: "1", name: "Product 1", sku: "SKU-001" }),
      makeProduct({ id: "2", name: "SKU-001 Product", sku: "" }),
    ];
    const result = matchProducts(products, "sku-001");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("returns fuzzy matches for name", () => {
    const products = [
      makeProduct({ id: "1", name: "Coffee Beans" }),
      makeProduct({ id: "2", name: "Tea Bags" }),
      makeProduct({ id: "3", name: "Coffee Maker" }),
    ];
    const result = matchProducts(products, "coffee");
    expect(result.map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("limits results to top N", () => {
    const products = Array.from({ length: 12 }, (_, i) =>
      makeProduct({ id: String(i), name: `Item ${i}` })
    );
    expect(matchProducts(products, "item", { limit: 5 })).toHaveLength(5);
  });
});
