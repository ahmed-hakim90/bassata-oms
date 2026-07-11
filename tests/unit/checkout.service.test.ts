import { describe, expect, it, vi, beforeEach } from "vitest";
import { completeCheckout } from "@/modules/pos/services/checkout.service";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as settingsService from "@/modules/system/services/settings.service";
import * as loyaltyService from "@/modules/loyalty/services/loyalty.service";
import { assertPeriodOpen, PeriodClosedError } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/inventory.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/modules/system/services/settings.service");
vi.mock("@/modules/loyalty/services/loyalty.service", () => ({
  earnPoints: vi.fn(),
  getLoyaltyRule: vi.fn(),
  getCustomerLoyaltyBalance: vi.fn(),
  redeemPoints: vi.fn(),
}));
vi.mock("@/lib/services/period-lock.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/period-lock.service")>();
  return {
    ...actual,
    assertPeriodOpen: vi.fn(),
  };
});

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
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(settingsService.getSessionSettings).mockResolvedValue({
      max_open_hours: 24,
      warn_after_hours: 20,
      block_sales_when_expired: true,
      require_manager_override_for_expired_sale: true,
      allow_manager_force_close: true,
      manager_discount_override_amount: null,
    });
    vi.mocked(catalogRepo.listVariants).mockResolvedValue([]);
    vi.mocked(catalogRepo.listVariantsForProducts).mockResolvedValue(new Map());
    vi.mocked(catalogRepo.getProduct).mockResolvedValue({
      id: "p1",
      org_id: "org-1",
      name: "Latte",
      sku: "LATTE",
      barcode: "",
      category_id: "cat-1",
      base_price: 10,
      description: "",
      sale_price: null,
      image_url: null,
      is_active: true,
      is_popular: false,
      track_inventory: false,
      product_type: "finished",
      inventory_tracking_mode: "standard",
      unit: "piece",
      last_unit_cost: 0,
      cost_unit: "piece",
      updated_at: new Date().toISOString(),
    });
    vi.mocked(catalogRepo.getProductsByIds).mockResolvedValue(
      new Map([
        [
          "p1",
          {
            id: "p1",
            org_id: "org-1",
            name: "Latte",
            sku: "LATTE",
            barcode: "",
            category_id: "cat-1",
            base_price: 10,
            description: "",
            sale_price: null,
            image_url: null,
            is_active: true,
            is_popular: false,
            track_inventory: false,
            product_type: "finished",
            inventory_tracking_mode: "standard",
            unit: "piece",
            last_unit_cost: 0,
            cost_unit: "piece",
            updated_at: new Date().toISOString(),
          },
        ],
      ])
    );
    vi.mocked(settingsService.isFeatureEnabled).mockResolvedValue(false);
    vi.mocked(warehouseRepo.getDefaultWarehouse).mockResolvedValue({
      id: "warehouse-1",
      org_id: "org-1",
      store_id: "store1",
      name: "Main",
      is_default: true,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    vi.mocked(inventoryRepo.listInventoryBatches).mockResolvedValue([]);
    vi.mocked(settingsService.getInventoryPolicySettings).mockResolvedValue({
      expiry_alerts_enabled: true,
      alert_days: [7, 14, 30],
      default_tracking_mode: "standard",
      default_rotation_method: "FIFO",
      default_expiry_policy: "block_sale",
      block_sale_of_expired_items: true,
      allow_manager_override: true,
    });
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

  it("rejects checkout when accounting period is closed", async () => {
    vi.mocked(assertPeriodOpen).mockRejectedValue(
      new PeriodClosedError("Operations are blocked: period 2026-01-01 – 2026-01-31 is closed.")
    );

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        cart: [],
        customer: null,
        paymentMethod: "cash",
      })
    ).rejects.toThrow(PeriodClosedError);

    expect(sessionRepo.getSession).not.toHaveBeenCalled();
    expect(orderRepo.completeCheckoutRpc).not.toHaveBeenCalled();
  });

  it("rejects checkout when session device does not match register", async () => {
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
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

    await expect(
      completeCheckout({
        storeId: "store1",
        sessionId: "s1",
        cashierId: "c1",
        deviceId: "device-b",
        cart: [],
        customer: null,
        paymentMethod: "cash",
      })
    ).rejects.toThrow("الجلسة لا تتطابق مع هذا الجهاز");
  });
});
