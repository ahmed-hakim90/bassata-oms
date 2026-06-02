import { describe, expect, it } from "vitest";
import {
  getVisibleAdvancedSettingsForProduct,
} from "@/modules/products/lib/advanced-settings-visibility";

describe("advanced settings visibility", () => {
  it("shows supermarket weight product settings", () => {
    const visible = getVisibleAdvancedSettingsForProduct(
      "supermarket",
      "finished_product",
      "weight"
    );

    expect(visible.has("batch_tracking")).toBe(true);
    expect(visible.has("expiry_tracking")).toBe(true);
    expect(visible.has("fefo")).toBe(true);
    expect(visible.has("fractional_quantity")).toBe(true);
    expect(visible.has("price_by_amount")).toBe(true);
    expect(visible.has("fixed_weight_variants")).toBe(true);
    expect(visible.has("wholesale")).toBe(true);
  });

  it("shows restaurant ingredient settings and hides unrelated ones", () => {
    const visible = getVisibleAdvancedSettingsForProduct(
      "restaurant",
      "ingredient",
      "weight"
    );

    expect(visible.has("batch_tracking")).toBe(true);
    expect(visible.has("expiry_tracking")).toBe(true);
    expect(visible.has("fefo")).toBe(true);
    expect(visible.has("wholesale")).toBe(false);
    expect(visible.has("price_by_amount")).toBe(false);
  });

  it("shows serial number controls for retail retail-product flow", () => {
    const visible = getVisibleAdvancedSettingsForProduct(
      "retail",
      "finished_product",
      "piece"
    );

    expect(visible.has("serial_number")).toBe(true);
    expect(visible.has("warranty")).toBe(true);
    expect(visible.has("batch_tracking")).toBe(false);
    expect(visible.has("expiry_tracking")).toBe(false);
    expect(visible.has("fefo")).toBe(false);
  });

  it("uses activity-specific controls for fresh food and electronics", () => {
    const freshFood = getVisibleAdvancedSettingsForProduct(
      "dairy_meat",
      "finished_product",
      "weight"
    );
    expect(freshFood.has("price_by_amount")).toBe(true);
    expect(freshFood.has("expiry_tracking")).toBe(true);
    expect(freshFood.has("fefo")).toBe(true);

    const electronics = getVisibleAdvancedSettingsForProduct(
      "electronics",
      "finished_product",
      "piece"
    );
    expect(electronics.has("serial_number")).toBe(true);
    expect(electronics.has("warranty")).toBe(true);
    expect(electronics.has("expiry_tracking")).toBe(false);
  });

  it("hides inventory settings for service", () => {
    const visible = getVisibleAdvancedSettingsForProduct("restaurant", "service", "piece");
    expect(visible.size).toBe(0);
  });

  it("uses union strategy for mixed activity", () => {
    const visible = getVisibleAdvancedSettingsForProduct(
      "mixed",
      "finished_product",
      "piece"
    );
    expect(visible.has("serial_number")).toBe(true);
    expect(visible.has("batch_tracking")).toBe(true);
    expect(visible.has("expiry_tracking")).toBe(true);
    expect(visible.has("wholesale")).toBe(true);
  });
});
