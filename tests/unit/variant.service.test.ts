import { describe, expect, it } from "vitest";
import { resolveVariantPrice } from "@/modules/products/services/variant.service";
import { buildVariantInsertPayload } from "@/lib/repositories/catalog.repository";

describe("resolveVariantPrice", () => {
  it("uses absolute variant price when set", () => {
    expect(resolveVariantPrice(4.5, { price: 6.5, price_delta: 0 })).toBe(6.5);
  });

  it("falls back to base price + delta", () => {
    expect(resolveVariantPrice(4.5, { price: null, price_delta: 1.25 })).toBe(5.75);
  });

  it("preserves weight-portion pricing fields in create payload", () => {
    expect(
      buildVariantInsertPayload("product-1", {
        name: "250g",
        sku: "P-250",
        barcode: "250",
        price_delta: 0,
        price: null,
        image_url: null,
        is_active: true,
        variant_kind: "weight_portion",
        quantity_value: 250,
        quantity_unit: "gram",
        price_mode: "fixed_price",
        fixed_price: 45,
      })
    ).toMatchObject({
      product_id: "product-1",
      variant_kind: "weight_portion",
      quantity_value: 250,
      quantity_unit: "gram",
      price_mode: "fixed_price",
      fixed_price: 45,
    });
  });
});
