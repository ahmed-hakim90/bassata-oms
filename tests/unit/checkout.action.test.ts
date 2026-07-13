import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutAction } from "@/modules/pos/actions/checkout.action";
import * as guards from "@/lib/auth/guards";
import * as posAccess from "@/lib/auth/pos-access";
import { completeCheckout } from "@/modules/pos/services/checkout.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    fn();
  },
}));
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
    vi.mocked(guards.requireFeatures).mockResolvedValue(undefined);
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
    vi.mocked(posAccess.getActiveSessionForPos).mockResolvedValue({
      id: "session-1",
      store_id: "store-1",
      cashier_id: "cashier-1",
      device_id: "device-1",
      status: "open",
      opening_cash: 0,
      opened_at: new Date().toISOString(),
      closed_at: null,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(getSessionSettings).mockResolvedValue({
      max_open_hours: 24,
      warn_after_hours: 20,
      block_sales_when_expired: true,
      require_manager_override_for_expired_sale: true,
      allow_manager_force_close: true,
      manager_discount_override_amount: null,
    });
    vi.mocked(completeCheckout).mockResolvedValue({
      order: {
        id: "order-1",
        store_id: "store-1",
        session_id: "session-1",
        order_number: "ORD-1",
        customer_id: null,
        status: "completed",
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        payment_status: "paid",
        created_by: "cashier-1",
        created_at: new Date().toISOString(),
      },
      orderNumber: "ORD-1",
    });
  });

  it("rejects zero-amount payments", async () => {
    const result = await checkoutAction({
      cart: [],
      customer: null,
      paymentMethod: "cash",
      payments: [{ method: "cash", amount: 0 }],
    });

    expect(result).toEqual({ success: false, error: "أدخل مبلغ دفع صالحاً" });
    expect(completeCheckout).not.toHaveBeenCalled();
  });

  it("prefers payments array over paymentMethod when completing checkout", async () => {
    const result = await checkoutAction({
      cart: [
        {
          id: "line-1",
          productId: "p1",
          variantId: null,
          name: "Latte",
          quantity: 1,
          unitPrice: 10,
          modifiers: [],
          lineTotal: 10,
          imageUrl: null,
        },
      ],
      customer: null,
      paymentMethod: "card",
      payments: [{ method: "cash", amount: 10 }],
    });

    expect(result.success).toBe(true);
    expect(completeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: "cash",
        payments: [{ method: "cash", amount: 10 }],
      })
    );
  });
});
