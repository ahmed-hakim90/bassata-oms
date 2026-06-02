import { describe, expect, it } from "vitest";
import { resolveVariantPrice } from "@/modules/products/services/variant.service";

describe("resolveVariantPrice", () => {
  it("uses absolute variant price when set", () => {
    expect(resolveVariantPrice(4.5, { price: 6.5, price_delta: 0 })).toBe(6.5);
  });

  it("falls back to base price + delta", () => {
    expect(resolveVariantPrice(4.5, { price: null, price_delta: 1.25 })).toBe(5.75);
  });
});
