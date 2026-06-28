import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutAction } from "@/modules/pos/actions/checkout.action";
import * as guards from "@/lib/auth/guards";
import * as posAccess from "@/lib/auth/pos-access";
import { completeCheckout } from "@/modules/pos/services/checkout.service";

vi.mock("@/lib/auth/guards");
vi.mock("@/lib/auth/pos-access");
vi.mock("@/modules/pos/services/checkout.service", () => ({ completeCheckout: vi.fn() }));
vi.mock("@/modules/sessions/services/session-lifecycle.service", () => ({
  computeSessionLifecycle: vi.fn(() => ({ blocksSales: false, lifecycle: "open", hoursOpen: 0 })),
}));
vi.mock("@/modules/system/services/settings.service", () => ({
  getSessionSettings: vi.fn(),
}));
vi.mock("@/modules/pos/services/manager-override.service", () => ({
  requiresManagerDiscountOverride: vi.fn(() => false),
}));
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({ getOrgId: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("checkoutAction payment validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(guards.requirePermissionOrRole).mockResolvedValue({
      id: "cashier-1",
      org_id: "org-1",
      auth_user_id: "auth-1",
      name: "Cashier",
      email: "cashier@test.com",
      role: "cashier",
      is_active: true,
      store_ids: ["store-1"],
    });
    vi.mocked(guards.requireFeature).mockResolvedValue(undefined);
    vi.mocked(posAccess.requirePosAccess).mockResolvedValue({
      user: {
        id: "cashier-1",
        org_id: "org-1",
        auth_user_id: "auth-1",
        name: "Cashier",
        email: "cashier@test.com",
        role: "cashier",
        is_active: true,
        store_ids: ["store-1"],
      },
      storeId: "store-1",
      deviceId: "device-1",
      activeCashierId: "cashier-1",
    });
  });

  it("rejects mismatched payment method and payment details", async () => {
    await expect(
      checkoutAction({
        cart: [],
        customer: null,
        paymentMethod: "card",
        payments: [{ method: "cash", amount: 10 }],
      })
    ).rejects.toThrow("Payment method does not match payment details");

    expect(completeCheckout).not.toHaveBeenCalled();
  });
});
