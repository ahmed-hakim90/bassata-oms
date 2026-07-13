import { describe, expect, it, vi, beforeEach } from "vitest";
import { completeCheckout } from "@/modules/pos/services/checkout.service";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as settingsService from "@/modules/system/services/settings.service";
import * as loyaltyService from "@/modules/loyalty/services/loyalty.service";

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    fn();
  },
}));
vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/order.repository");
vi.mock("@/modules/system/services/settings.service");
vi.mock("@/modules/loyalty/services/loyalty.service", () => ({
  earnPoints: vi.fn(),
  getLoyaltyRule: vi.fn(),
  getCustomerLoyaltyBalance: vi.fn(),
  redeemPoints: vi.fn(),
}));

const cartLine = {
  id: "line-1",
  productId: "p1",
  variantId: null,
  name: "Latte",
  quantity: 1,
  unitPrice: 10,
  modifiers: [],
  lineTotal: 10,
  imageUrl: null,
};

describe("completeCheckout session expiry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(settingsService.getSessionSettings).mockResolvedValue({
      max_open_hours: 24,
      warn_after_hours: 20,
      block_sales_when_expired: true,
      require_manager_override_for_expired_sale: true,
      allow_manager_force_close: true,
      manager_discount_override_amount: null,
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);
  });

  it("rejects checkout when session is expired and blocking is enabled", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        cart: [],
        customer: null,
        paymentMethod: "cash",
      })
    ).rejects.toThrow("انتهت الجلسة - أغلق الوردية للمتابعة");

    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("uses expired-session override RPC when override is provided", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutExpiredOverrideRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-001",
      subtotal: 10,
      tax: 0,
      total: 10,
    });
    vi.mocked(orderRepo.getOrder).mockResolvedValue({
      id: "o1",
      store_id: "store1",
      session_id: "s1",
      order_number: "SF-001",
      customer_id: null,
      status: "completed",
      subtotal: 10,
      discount: 0,
      tax: 0,
      total: 10,
      payment_status: "paid",
      created_by: "c1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);

    await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      cart: [cartLine],
      customer: null,
      paymentMethod: "cash",
      override: { expiredSession: true },
    });

    expect(orderRepo.completeCheckoutExpiredOverrideRpc).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s1", paymentMethod: "cash" })
    );
    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("allows checkout when session is within limits", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-001",
      subtotal: 10,
      tax: 0,
      total: 10,
    });
    vi.mocked(orderRepo.getOrder).mockResolvedValue({
      id: "o1",
      store_id: "store1",
      session_id: "s1",
      order_number: "SF-001",
      customer_id: null,
      status: "completed",
      subtotal: 10,
      discount: 0,
      tax: 0,
      total: 10,
      payment_status: "paid",
      created_by: "c1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);

    const result = await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      cart: [cartLine],
      customer: null,
      paymentMethod: "cash",
    });

    expect(result.orderNumber).toBe("SF-001");
    expect(orderRepo.completeCheckoutRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
      })
    );
  });

  it("passes device id to checkout RPC when provided", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: "device-a",
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-001",
      subtotal: 10,
      tax: 0,
      total: 10,
    });
    vi.mocked(orderRepo.getOrder).mockResolvedValue({
      id: "o1",
      store_id: "store1",
      session_id: "s1",
      order_number: "SF-001",
      customer_id: null,
      status: "completed",
      subtotal: 10,
      discount: 0,
      tax: 0,
      total: 10,
      payment_status: "paid",
      created_by: "c1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);

    await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      deviceId: "device-a",
      cart: [cartLine],
      customer: null,
      paymentMethod: "cash",
    });

    expect(orderRepo.completeCheckoutRpc).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-a" })
    );
  });

  it("uses split checkout RPC when multiple payments are provided", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutSplitRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-001",
      subtotal: 10,
      tax: 0,
      total: 10,
    });
    vi.mocked(orderRepo.getOrder).mockResolvedValue({
      id: "o1",
      store_id: "store1",
      session_id: "s1",
      order_number: "SF-001",
      customer_id: null,
      status: "completed",
      subtotal: 10,
      discount: 0,
      tax: 0,
      total: 10,
      payment_status: "paid",
      created_by: "c1",
      created_at: new Date().toISOString(),
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);

    await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      cart: [cartLine],
      customer: null,
      paymentMethod: "cash",
      payments: [
        { method: "cash", amount: 4 },
        { method: "card", amount: 6 },
      ],
    });

    expect(orderRepo.completeCheckoutSplitRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: "cash",
        payments: [
          { method: "cash", amount: 4 },
          { method: "card", amount: 6 },
        ],
      })
    );
    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("uses split RPC payment_status for partial credit checkout", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutSplitRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-002",
      subtotal: 100,
      tax: 0,
      total: 100,
      payment_status: "partial",
      credit_amount: 40,
    });
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);

    const result = await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      cart: [
        {
          ...cartLine,
          lineTotal: 100,
          unitPrice: 100,
        },
      ],
      customer: {
        id: "cust-1",
        org_id: "org-1",
        name: "Mona",
        phone: "010",
        email: null,
        total_spent: 0,
        visit_count: 0,
        account_balance: 0,
        credit_limit: 500,
        payment_terms: "",
        notes: "",
        created_at: new Date().toISOString(),
      },
      paymentMethod: "cash",
      payments: [
        { method: "cash", amount: 60 },
        { method: "credit", amount: 40 },
      ],
    });

    expect(orderRepo.completeCheckoutSplitRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust-1",
        payments: [
          { method: "cash", amount: 60 },
          { method: "credit", amount: 40 },
        ],
      })
    );
    expect(result.order.payment_status).toBe("partial");
  });

  it("rejects an empty cart before checkout RPC", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        cart: [],
        customer: null,
        paymentMethod: "cash",
      })
    ).rejects.toThrow("السلة فارغة");

    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("rejects a discount larger than the cart subtotal", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        cart: [cartLine],
        customer: null,
        paymentMethod: "cash",
        discount: 10.02,
      })
    ).rejects.toThrow("قيمة الخصم أكبر من إجمالي الفاتورة");

    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("rejects loyalty redemption below the configured minimum", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(loyaltyService.getLoyaltyRule).mockResolvedValue({
      id: "rule-1",
      org_id: "org-1",
      points_per_currency: 1,
      redemption_rate: 0.01,
      minimum_redeem_points: 50,
      is_active: true,
    });

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        cart: [cartLine],
        customer: {
          id: "customer-1",
          org_id: "org-1",
          name: "Sara",
          phone: "01000000000",
          email: null,
          total_spent: 0,
          visit_count: 0,
          account_balance: 0,
          credit_limit: 0,
          payment_terms: "",
          notes: "",
          created_at: new Date().toISOString(),
        },
        paymentMethod: "cash",
        loyaltyPoints: 20,
      })
    ).rejects.toThrow("الحد الأدنى لاستبدال النقاط هو 50 نقطة");

    expect(loyaltyService.getCustomerLoyaltyBalance).not.toHaveBeenCalled();
    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("passes device id through to RPC for another paired store device", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: "device-a",
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.completeCheckoutRpc).mockResolvedValue({
      order_id: "o1",
      order_number: "SF-001",
      subtotal: 10,
      tax: 0,
      total: 10,
    });

    await completeCheckout({
      storeId: "store1",
      sessionId: "s1",
      cashierId: "c1",
      deviceId: "device-b",
      cart: [cartLine],
      customer: null,
      paymentMethod: "cash",
    });

    expect(orderRepo.completeCheckoutRpc).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-b" })
    );
  });
});
