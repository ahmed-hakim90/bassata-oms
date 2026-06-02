import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY,
  type ProductTemplateSettings,
} from "@/lib/constants";
import {
  normalizeProductTemplateSettings,
} from "@/modules/system/services/settings.service";
import {
  resolveProductTemplateId,
} from "@/modules/products/lib/apply-product-template";

describe("product activity templates", () => {
  it("uses activity-specific defaults instead of cloned cafe templates", () => {
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.supermarket.supermarket_weight_product.wholesale_enabled
    ).toBe(true);
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.cafe.supermarket_weight_product.wholesale_enabled
    ).toBe(false);
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.retail.retail_product.inventory_tracking_mode
    ).toBe("standard");
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.restaurant.retail_product.inventory_tracking_mode
    ).toBe("batch_and_expiry");
  });

  it("resolves template ids from activity and product shape", () => {
    expect(resolveProductTemplateId("supermarket", "finished_product", "weight")).toBe(
      "supermarket_weight_product"
    );
    expect(resolveProductTemplateId("dairy_meat", "finished_product", "weight")).toBe(
      "supermarket_weight_product"
    );
    expect(resolveProductTemplateId("restaurant", "raw_material", "weight")).toBe(
      "restaurant_ingredient"
    );
    expect(resolveProductTemplateId("bakery", "raw_material", "weight")).toBe(
      "restaurant_ingredient"
    );
    expect(resolveProductTemplateId("mixed", "service", "piece")).toBe("service");
  });

  it("sets concrete defaults for the added activity presets", () => {
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.dairy_meat.supermarket_weight_product.allow_price_input
    ).toBe(true);
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.dairy_meat.supermarket_weight_product.expiry_policy
    ).toBe("block_sale");
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.electronics.retail_product.inventory_tracking_mode
    ).toBe("serial_number");
    expect(
      DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.bakery.retail_product.expiry_tracking_enabled
    ).toBe(true);
  });

  it("normalizes partial persisted settings against the selected activity defaults", () => {
    const input = {
      retail_product: {
        wholesale_enabled: true,
      },
    } as unknown as Partial<ProductTemplateSettings>;

    const normalized = normalizeProductTemplateSettings(input, "supermarket");

    expect(normalized.retail_product.id).toBe("retail_product");
    expect(normalized.retail_product.wholesale_enabled).toBe(true);
    expect(normalized.supermarket_weight_product.wholesale_enabled).toBe(true);
    expect(normalized.supermarket_weight_product.allow_price_input).toBe(true);
  });
});
