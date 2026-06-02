import { describe, expect, it } from "vitest";
import { normalizeOnlineMenuSettings } from "@/modules/system/services/settings.service";
import {
  buildPublicOrderLines,
  resolvePublicVariantPrice,
  type PublicMenuProduct,
} from "@/modules/online-menu/services/public-menu.service";

function product(overrides: Partial<PublicMenuProduct> = {}): PublicMenuProduct {
  return {
    id: "p1",
    categoryId: "cat",
    name: "Vanilla Scoop",
    sku: "VAN",
    barcode: "100",
    price: 50,
    imageUrl: null,
    isPopular: true,
    variants: [],
    ...overrides,
  };
}

describe("public menu service helpers", () => {
  it("uses absolute variant price when available", () => {
    expect(resolvePublicVariantPrice(50, { price: 65, price_delta: 0 })).toBe(65);
  });

  it("falls back to base price plus variant delta", () => {
    expect(resolvePublicVariantPrice(50, { price: null, price_delta: 10 })).toBe(60);
  });

  it("groups order lines by product and variant", () => {
    const lines = buildPublicOrderLines(
      [
        product({
          variants: [
            {
              id: "v1",
              name: "Small",
              sku: "VAN-S",
              barcode: "100-S",
              price: 50,
              imageUrl: null,
            },
            {
              id: "v2",
              name: "Large",
              sku: "VAN-L",
              barcode: "100-L",
              price: 70,
              imageUrl: null,
            },
          ],
        }),
      ],
      [
        { productId: "p1", variantId: "v1", quantity: 1 },
        { productId: "p1", variantId: "v1", quantity: 2 },
        { productId: "p1", variantId: "v2", quantity: 1 },
      ]
    );

    expect(lines).toEqual([
      {
        productId: "p1",
        variantId: "v1",
        quantity: 3,
        unitPrice: 50,
        lineTotal: 150,
      },
      {
        productId: "p1",
        variantId: "v2",
        quantity: 1,
        unitPrice: 70,
        lineTotal: 70,
      },
    ]);
  });

  it("rejects a variant that is not available for the product", () => {
    expect(() =>
      buildPublicOrderLines([product()], [{ productId: "p1", variantId: "missing", quantity: 1 }])
    ).toThrow("A product option in the cart is no longer available");
  });

  it("merges online menu settings with defaults", () => {
    const settings = normalizeOnlineMenuSettings({
      showCart: false,
      primaryColor: "not-a-color",
      accentColor: "#22C55E",
      productCardStyle: "compact",
    });

    expect(settings.showCart).toBe(false);
    expect(settings.showSearch).toBe(true);
    expect(settings.primaryColor).toBe("#2563EB");
    expect(settings.accentColor).toBe("#22C55E");
    expect(settings.productCardStyle).toBe("compact");
  });
});
