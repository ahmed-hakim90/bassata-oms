import { describe, expect, it } from "vitest";
import { BUSINESS_ACTIVITY_TYPES } from "@/lib/constants";
import {
  buildOnboardingFeatureFlags,
  defaultOnboardingFeaturesForActivity,
  mapBusinessTypeToActivity,
  mapOnboardingFeaturesToFlags,
} from "@/modules/onboarding/schemas/onboarding.schema";

describe("S08 onboarding ↔ settings parity helpers", () => {
  it("maps onboarding features to the same Settings flag keys", () => {
    const flags = mapOnboardingFeaturesToFlags(
      {
        recipes: true,
        variants: false,
        purchases: true,
        transfers: false,
        waste: true,
        stock_count: true,
        loyalty: false,
        customer_accounts: true,
        credit_sales: true,
        imports_exports: false,
        barcode_scanner: true,
      },
      { taxEnabled: false, preventNegativeStock: true }
    );

    expect(flags).toMatchObject({
      recipes: true,
      purchases: true,
      transfers: false,
      waste: true,
      stock_count: true,
      loyalty: false,
      customer_discounts: true,
      credit_sales: true,
      imports_exports: false,
      barcode_scanner: true,
      tax: false,
      prevent_negative_stock: true,
    });
    expect(flags).not.toHaveProperty("variants");
  });

  it("writes enable_variants from onboarding variants toggle", () => {
    const cafeWithVariants = mapBusinessTypeToActivity("cafe", {
      enableVariants: true,
    });
    const cafeWithout = mapBusinessTypeToActivity("cafe", {
      enableVariants: false,
    });
    expect(cafeWithVariants.enable_variants).toBe(true);
    expect(cafeWithout.enable_variants).toBe(false);

    // Supermarket preset locks variants off — onboarding checkbox cannot override.
    const supermarketForced = mapBusinessTypeToActivity("supermarket", {
      enableVariants: true,
    });
    expect(supermarketForced.enable_variants).toBe(false);
    expect(supermarketForced.enable_weight_sales).toBe(true);
  });

  it("covers every DB-supported activity type in app constants", () => {
    expect([...BUSINESS_ACTIVITY_TYPES].sort()).toEqual(
      [
        "cafe",
        "ice_cream",
        "juice_bar",
        "mixed",
        "restaurant",
        "retail",
        "supermarket",
        "wholesale",
      ].sort()
    );
  });

  it("prefills features from activity presets", () => {
    const supermarket = defaultOnboardingFeaturesForActivity("supermarket");
    expect(supermarket.variants).toBe(false);
    expect(supermarket.recipes).toBe(false);

    const iceCream = defaultOnboardingFeaturesForActivity("ice_cream");
    expect(iceCream.recipes).toBe(true);
    expect(iceCream.variants).toBe(true);
  });

  it("buildOnboardingFeatureFlags includes tax + prevent_negative_stock", () => {
    const features = defaultOnboardingFeaturesForActivity("cafe");
    const flags = buildOnboardingFeatureFlags({
      businessType: "cafe",
      features,
      organization: {
        name: "Test",
        currency: "EGP",
        timezone: "Africa/Cairo",
        country: "EG",
        taxEnabled: true,
        taxRate: 14,
        taxInclusive: true,
      },
      defaultSettings: {
        paymentMethods: {
          cash: true,
          card: true,
          wallet: true,
          credit: false,
          manualWallet: true,
        },
        preventNegativeStock: true,
        defaultTaxBehavior: "inclusive",
        sessionRules: {
          maxOpenHours: 24,
          warnAfterHours: 20,
          blockSalesWhenExpired: true,
          requireManagerOverrideForExpiredSale: true,
          allowManagerForceClose: true,
        },
        expenseRules: {
          approvalRequired: false,
          cashierCanAddSessionExpense: true,
          allowInventoryPurchaseFromSession: true,
          preventExpensesInClosedPeriods: true,
        },
      },
    });

    expect(flags.tax).toBe(true);
    expect(flags.prevent_negative_stock).toBe(true);
    expect(flags.barcode_scanner).toBe(true);
  });
});
