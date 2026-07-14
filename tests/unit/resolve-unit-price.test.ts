import { describe, expect, it } from "vitest";
import { resolveUnitPrice } from "@/modules/products/lib/resolve-unit-price";
import {
  convertQuantityForPricing,
  productPackingForPricing,
} from "@/lib/units";
import type { ProductPriceTier } from "@/lib/types";

function tier(
  overrides: Partial<ProductPriceTier> &
    Pick<ProductPriceTier, "id" | "min_quantity" | "price" | "sale_mode">
): ProductPriceTier {
  return {
    org_id: "o1",
    product_id: "p1",
    variant_id: null,
    name: "tier",
    unit: "piece",
    active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const cartonPack = {
  baseUnit: "piece" as const,
  packUnit: "carton" as const,
  unitsPerPack: 24,
};

describe("convertQuantityForPricing", () => {
  it("converts piece → carton with packing factor", () => {
    expect(
      convertQuantityForPricing({
        quantity: 24,
        from: "piece",
        to: "carton",
        packing: cartonPack,
      })
    ).toBe(1);
    expect(
      convertQuantityForPricing({
        quantity: 48,
        from: "piece",
        to: "carton",
        packing: cartonPack,
      })
    ).toBe(2);
  });

  it("returns null for pack mismatch without packing context", () => {
    expect(
      convertQuantityForPricing({
        quantity: 24,
        from: "piece",
        to: "carton",
        packing: null,
      })
    ).toBeNull();
  });

  it("builds packing from product purchase fields", () => {
    expect(
      productPackingForPricing({
        unit: "piece",
        base_unit: "piece",
        cost_unit: "carton",
        units_per_purchase_unit: 24,
      })
    ).toEqual(cartonPack);
    expect(
      productPackingForPricing({
        unit: "piece",
        cost_unit: "piece",
        units_per_purchase_unit: 1,
      })
    ).toBeNull();
  });
});

describe("resolveUnitPrice", () => {
  it("returns base price when no tiers match", () => {
    const result = resolveUnitPrice({
      basePrice: 12,
      quantity: 1,
      saleUnit: "piece",
      saleMode: "retail",
      autoApplyWholesale: false,
      tiers: [],
    });
    expect(result).toEqual({ unitPrice: 12, tierId: null, wholesaleApplied: false });
  });

  it("picks highest eligible min_quantity tier for the same sale mode", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 50,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers: [
        tier({ id: "t10", min_quantity: 10, price: 9, sale_mode: "wholesale" }),
        tier({ id: "t50", min_quantity: 50, price: 8, sale_mode: "wholesale" }),
        tier({ id: "t100", min_quantity: 100, price: 7, sale_mode: "wholesale" }),
      ],
    });
    expect(result.unitPrice).toBe(8);
    expect(result.tierId).toBe("t50");
    expect(result.wholesaleApplied).toBe(true);
  });

  it("ignores inactive tiers", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 100,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers: [
        tier({ id: "off", min_quantity: 10, price: 5, sale_mode: "wholesale", active: false }),
      ],
    });
    expect(result.tierId).toBeNull();
    expect(result.unitPrice).toBe(10);
  });

  it("keeps retail tiers only when autoApplyWholesale is false", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 20,
      saleUnit: "piece",
      saleMode: "retail",
      autoApplyWholesale: false,
      tiers: [
        tier({ id: "w", min_quantity: 10, price: 7, sale_mode: "wholesale" }),
        tier({ id: "r", min_quantity: 10, price: 9, sale_mode: "retail" }),
      ],
    });
    expect(result.tierId).toBe("r");
    expect(result.unitPrice).toBe(9);
    expect(result.wholesaleApplied).toBe(false);
  });

  it("auto-applies wholesale tier from retail mode when enabled", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 20,
      saleUnit: "piece",
      saleMode: "retail",
      autoApplyWholesale: true,
      tiers: [
        tier({ id: "w", min_quantity: 10, price: 7, sale_mode: "wholesale" }),
        tier({ id: "r", min_quantity: 5, price: 9, sale_mode: "retail" }),
      ],
    });
    expect(result.tierId).toBe("w");
    expect(result.unitPrice).toBe(7);
    expect(result.wholesaleApplied).toBe(true);
  });

  it("treats kg↔gram quantity before comparing min_quantity", () => {
    const result = resolveUnitPrice({
      basePrice: 100,
      quantity: 2,
      saleUnit: "kg",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers: [
        tier({
          id: "g",
          min_quantity: 1500,
          price: 80,
          sale_mode: "wholesale",
          unit: "gram",
        }),
      ],
    });
    expect(result.tierId).toBe("g");
    expect(result.unitPrice).toBe(80);
  });

  it("applies carton tier only when piece qty covers full pack", () => {
    const tiers = [
      tier({
        id: "carton",
        min_quantity: 1,
        price: 8,
        sale_mode: "wholesale",
        unit: "carton",
      }),
    ];

    const below = resolveUnitPrice({
      basePrice: 10,
      quantity: 23,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers,
      packing: cartonPack,
    });
    expect(below.tierId).toBeNull();
    expect(below.unitPrice).toBe(10);

    const exact = resolveUnitPrice({
      basePrice: 10,
      quantity: 24,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers,
      packing: cartonPack,
    });
    expect(exact.tierId).toBe("carton");
    expect(exact.unitPrice).toBe(8);
  });

  it("skips carton tier when packing is missing (no silent false match)", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 24,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      tiers: [
        tier({
          id: "carton",
          min_quantity: 1,
          price: 200,
          sale_mode: "wholesale",
          unit: "carton",
        }),
      ],
      packing: null,
    });
    expect(result.tierId).toBeNull();
    expect(result.unitPrice).toBe(10);
  });

  it("prefers higher min in sale units across mixed piece/carton tiers", () => {
    const result = resolveUnitPrice({
      basePrice: 10,
      quantity: 48,
      saleUnit: "piece",
      saleMode: "wholesale",
      autoApplyWholesale: false,
      packing: cartonPack,
      tiers: [
        tier({
          id: "c1",
          min_quantity: 1,
          price: 9,
          sale_mode: "wholesale",
          unit: "carton",
        }),
        tier({
          id: "p40",
          min_quantity: 40,
          price: 7.5,
          sale_mode: "wholesale",
          unit: "piece",
        }),
      ],
    });
    // 1 carton = 24 pieces < 40 pieces → prefer piece tier
    expect(result.tierId).toBe("p40");
    expect(result.unitPrice).toBe(7.5);
  });
});
