import { describe, expect, it } from "vitest";
import { findPosProductByBarcode } from "@/modules/pos/utils/barcode-lookup";
import type { POSProduct } from "@/modules/pos/services/catalog.service";

function mockProduct(overrides: Partial<POSProduct> = {}): POSProduct {
  return {
    id: "p1",
    org_id: "org",
    name: "Vanilla",
    sku: "ICE-001",
    barcode: "100001",
    category_id: "cat",
    base_price: 4.5,
    description: "",
    sale_price: null,
    updated_at: new Date().toISOString(),
    is_active: true,
    is_popular: false,
    track_inventory: false,
    image_url: null,
    product_type: "finished",
    unit: "piece",
    last_unit_cost: 0,
    cost_unit: "piece",
    stockQuantity: null,
    stockBadge: "untracked",
    categoryName: "Ice Cream",
    categoryColor: "#fff",
    hasRecipe: true,
    hasVariants: true,
    variants: [
      {
        id: "v1",
        name: "Small",
        sku: "ICE-001-S",
        barcode: "100001-S",
        price: 4.5,
        imageUrl: null,
        stockQuantity: 10,
        stockBadge: "in_stock",
        hasRecipe: true,
      },
    ],
    ...overrides,
  };
}

describe("findPosProductByBarcode", () => {
  it("finds variant by barcode", () => {
    const products = [mockProduct()];
    const match = findPosProductByBarcode(products, "100001-S");
    expect(match?.variant?.name).toBe("Small");
  });

  it("finds product without variants by barcode", () => {
    const products = [
      mockProduct({
        hasVariants: false,
        variants: [],
        barcode: "200001",
      }),
    ];
    const match = findPosProductByBarcode(products, "200001");
    expect(match?.product.name).toBe("Vanilla");
    expect(match?.variant).toBeNull();
  });
});
