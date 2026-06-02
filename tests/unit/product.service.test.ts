import { describe, expect, it } from "vitest";
import { deriveProductCapabilityFields } from "@/modules/products/services/product.service";

describe("deriveProductCapabilityFields", () => {
  it("marks weight and amount sale support for weight products with price input", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "finished_product",
        sales_unit_type: "weight",
        allow_price_input: true,
        inventory_tracking_mode: "batch_and_expiry",
        track_inventory: true,
      })
    ).toEqual({
      inventory_product_type: "finished_product",
      supports_weight_sale: true,
      supports_amount_sale: true,
    });
  });

  it("maps legacy ingredient type to raw material inventory product type", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "ingredient",
        sales_unit_type: "weight",
        allow_price_input: false,
        inventory_tracking_mode: "batch",
        track_inventory: true,
      })
    ).toEqual({
      inventory_product_type: "raw_material",
      supports_weight_sale: true,
      supports_amount_sale: false,
    });
  });
});
