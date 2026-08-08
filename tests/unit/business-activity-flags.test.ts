import { describe, expect, it } from "vitest";
import {
  buildBusinessActivityFeatureFlags,
  isFoodServiceActivity,
  productImportTemplateGroup,
  supportsProductModifiers,
  usesCafeMenuCatalog,
  variantsLockedByActivity,
} from "@/lib/business-activity-flags";
import { BUSINESS_ACTIVITY_TYPES } from "@/lib/constants";

/** Locked matrix — change only with intentional product decision. */
const EXPECTED: Record<
  (typeof BUSINESS_ACTIVITY_TYPES)[number],
  { recipes: boolean; credit_sales?: boolean; barcode_scanner: boolean }
> = {
  cafe: { recipes: false, barcode_scanner: true },
  ice_cream: { recipes: true, barcode_scanner: true },
  juice_bar: { recipes: true, barcode_scanner: true },
  restaurant: { recipes: true, barcode_scanner: true },
  supermarket: { recipes: false, barcode_scanner: true },
  retail: { recipes: false, barcode_scanner: true },
  wholesale: { recipes: false, credit_sales: true, barcode_scanner: true },
  mixed: { recipes: false, credit_sales: true, barcode_scanner: true },
  bakery: { recipes: true, barcode_scanner: true },
  pharmacy: { recipes: false, barcode_scanner: true },
};

describe("buildBusinessActivityFeatureFlags (activity SSOT)", () => {
  it("covers every activity type with the locked flag matrix", () => {
    for (const activity of BUSINESS_ACTIVITY_TYPES) {
      const flags = buildBusinessActivityFeatureFlags({ activity_type: activity });
      const expected = EXPECTED[activity];
      expect(flags.recipes).toBe(expected.recipes);
      expect(flags.barcode_scanner).toBe(expected.barcode_scanner);
      if (expected.credit_sales) {
        expect(flags.credit_sales).toBe(true);
      } else {
        expect(flags.credit_sales).toBeUndefined();
      }
    }
  });

  it("marks food-service lineage without treating cafe as recipe-default", () => {
    expect(isFoodServiceActivity("cafe")).toBe(true);
    expect(isFoodServiceActivity("restaurant")).toBe(true);
    expect(isFoodServiceActivity("bakery")).toBe(true);
    expect(isFoodServiceActivity("supermarket")).toBe(false);
    expect(isFoodServiceActivity("pharmacy")).toBe(false);
    expect(buildBusinessActivityFeatureFlags({ activity_type: "cafe" }).recipes).toBe(
      false
    );
  });

  it("aligns modifiers with food-service including ice_cream", () => {
    expect(supportsProductModifiers("ice_cream")).toBe(true);
    expect(supportsProductModifiers("pharmacy")).toBe(false);
  });

  it("uses cafe catalog for food-service without weight sales", () => {
    expect(
      usesCafeMenuCatalog({ activity_type: "cafe", enable_weight_sales: false })
    ).toBe(true);
    expect(
      usesCafeMenuCatalog({ activity_type: "bakery", enable_weight_sales: true })
    ).toBe(false);
    expect(
      usesCafeMenuCatalog({ activity_type: "pharmacy", enable_weight_sales: false })
    ).toBe(false);
  });

  it("locks variants for supermarket and pharmacy", () => {
    expect(variantsLockedByActivity("supermarket")).toBe(true);
    expect(variantsLockedByActivity("pharmacy")).toBe(true);
    expect(variantsLockedByActivity("cafe")).toBe(false);
  });

  it("maps import template groups by activity", () => {
    expect(productImportTemplateGroup("supermarket")).toBe("supermarket");
    expect(productImportTemplateGroup("restaurant")).toBe("kitchen");
    expect(productImportTemplateGroup("pharmacy")).toBe("shelf");
    expect(productImportTemplateGroup("wholesale")).toBe("shelf");
  });
});
