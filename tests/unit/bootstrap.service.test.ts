import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeOrganization,
  OwnerEmailAlreadyUsedError,
} from "@/modules/onboarding/services/bootstrap.service";

const adminMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
    }),
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => adminMock),
}));

vi.mock("@/lib/online-menu-path", () => ({
  slugifyBranchName: vi.fn(() => "main"),
}));

describe("initializeOrganization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "owner-1" }, error: null }),
          }),
        }),
      }),
    }));
  });

  it("blocks onboarding when owner email already used", async () => {
    await expect(
      initializeOrganization({
        organization: {
          name: "Org A",
          currency: "USD",
          timezone: "America/New_York",
          country: "US",
          logoUrl: "",
          taxEnabled: true,
          taxRate: 0,
          taxInclusive: true,
        },
        store: { name: "Store A", address: "Address", phone: "", timezone: "America/New_York" },
        owner: { name: "Owner", email: "owner@orga.com", password: "secret123" },
        businessType: "retail",
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
        defaultSettings: {
          paymentMethods: {
            cash: true,
            card: true,
            wallet: true,
            credit: false,
            manualWallet: true,
          },
          receiptHeader: "",
          receiptFooter: "",
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
        initialSetup: {
          createDefaultCostCenters: true,
          createDefaultExpenseCategories: true,
          createDefaultProductCategories: true,
          createDefaultInventoryUnits: true,
          createFirstPosDevice: false,
          firstPosDeviceName: "POS-1",
        },
      })
    ).rejects.toBeInstanceOf(OwnerEmailAlreadyUsedError);

    expect(adminMock.rpc).not.toHaveBeenCalled();
  });
});
