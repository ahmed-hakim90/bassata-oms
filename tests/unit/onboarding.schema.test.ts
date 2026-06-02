import { describe, expect, it } from "vitest";
import {
  mapBusinessTypeToActivity,
  mapOnboardingFeaturesToFlags,
  onboardingPayloadSchema,
} from "@/modules/onboarding/schemas/onboarding.schema";

describe("onboarding schema", () => {
  it("accepts the v2 onboarding payload", () => {
    const payload = {
      organization: {
        name: "Acme Foods",
        logoUrl: "",
        currency: "USD",
        timezone: "America/New_York",
        country: "US",
        taxEnabled: true,
        taxRate: 14,
        taxInclusive: true,
      },
      store: {
        name: "Downtown",
        address: "Main St",
        phone: "123",
        timezone: "America/New_York",
      },
      owner: {
        name: "Owner",
        email: "owner@acme.com",
        password: "secret123",
      },
      businessType: "retail",
      defaultSettings: {
        paymentMethods: {
          cash: true,
          card: true,
          wallet: true,
          credit: false,
          manualWallet: true,
        },
        receiptHeader: "Welcome",
        receiptFooter: "Thanks",
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
      features: {
        recipes: true,
        variants: true,
        weight_sales: false,
        wholesale_sales: false,
        purchases: true,
        transfers: true,
        waste: true,
        stock_count: true,
        loyalty: true,
        customer_accounts: true,
        credit_sales: false,
        monthly_closing: true,
        imports_exports: true,
        barcode_scanner: true,
      },
      initialSetup: {
        createDefaultCostCenters: true,
        createDefaultExpenseCategories: true,
        createDefaultProductCategories: true,
        createDefaultInventoryUnits: true,
        createFirstPosDevice: true,
        firstPosDeviceName: "POS-1",
      },
    };

    expect(() => onboardingPayloadSchema.parse(payload)).not.toThrow();
  });

  it("maps feature and business activity flags", () => {
    const flags = mapOnboardingFeaturesToFlags({
      recipes: true,
      variants: true,
      weight_sales: true,
      wholesale_sales: true,
      purchases: true,
      transfers: true,
      waste: true,
      stock_count: true,
      loyalty: true,
      customer_accounts: true,
      credit_sales: true,
      monthly_closing: true,
      imports_exports: true,
      barcode_scanner: true,
    });
    expect(flags.weight_sales).toBe(true);
    expect(flags.fixed_weight_variants).toBe(true);
    expect(flags.customer_discounts).toBe(true);
    expect(flags.imports_exports).toBe(true);

    const activity = mapBusinessTypeToActivity("wholesale");
    expect(activity.activity_type).toBe("wholesale");
    expect(activity.default_sales_mode).toBe("wholesale");
    expect(activity.enable_wholesale_sales).toBe(true);

    const freshFood = mapBusinessTypeToActivity("dairy_meat");
    expect(freshFood.enable_weight_sales).toBe(true);
    expect(freshFood.enable_price_by_amount).toBe(true);
    expect(freshFood.enable_wholesale_sales).toBe(false);
  });
});
