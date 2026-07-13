import { beforeEach, describe, expect, it, vi } from "vitest";
import { callRpc } from "@/lib/repositories/client";
import {
  completeCheckoutExpiredOverrideRpc,
  completeCheckoutRpc,
  completeCheckoutSplitExpiredOverrideRpc,
  completeCheckoutSplitRpc,
} from "@/lib/repositories/order.repository";

vi.mock("@/lib/repositories/client", () => ({
  callRpc: vi.fn(),
  getDb: vi.fn(),
  throwDbError: vi.fn((error: { message?: string } | null, context: string) => {
    throw new Error(error?.message ?? context);
  }),
}));

const checkoutInput = {
  storeId: "store-1",
  sessionId: "session-1",
  cashierId: "cashier-1",
  deviceId: "device-1",
  customerId: null,
  paymentMethod: "cash" as const,
  salesMode: "wholesale" as const,
  discount: 0,
  lines: [{ product_id: "product-1", variant_id: null, quantity: 1 }],
};

describe("order repository checkout RPC wrappers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(callRpc).mockResolvedValue({
      data: {
        order_id: "order-1",
        order_number: "SF-001",
        subtotal: 10,
        tax: 0,
        total: 10,
      },
      error: null,
    });
  });

  it("passes sales mode to single-payment checkout", async () => {
    await completeCheckoutRpc(checkoutInput);

    expect(callRpc).toHaveBeenCalledWith(
      "complete_checkout",
      expect.objectContaining({ p_sales_mode: "wholesale" })
    );
  });

  it("passes sales mode to split checkout", async () => {
    await completeCheckoutSplitRpc({
      ...checkoutInput,
      payments: [
        { method: "cash", amount: 4 },
        { method: "card", amount: 6 },
      ],
    });

    expect(callRpc).toHaveBeenCalledWith(
      "complete_checkout_split",
      expect.objectContaining({ p_sales_mode: "wholesale" })
    );
  });

  it("maps payment_status from partial credit split RPC", async () => {
    vi.mocked(callRpc).mockResolvedValue({
      data: {
        order_id: "order-1",
        order_number: "SF-001",
        subtotal: 100,
        tax: 0,
        total: 100,
        payment_status: "partial",
        credit_amount: 40,
      },
      error: null,
    });

    const result = await completeCheckoutSplitRpc({
      ...checkoutInput,
      customerId: "cust-1",
      payments: [
        { method: "cash", amount: 60 },
        { method: "credit", amount: 40 },
      ],
    });

    expect(result.payment_status).toBe("partial");
    expect(result.credit_amount).toBe(40);
  });

  it("calls refund_order RPC", async () => {
    const { refundOrderRpc } = await import("@/lib/repositories/order.repository");
    vi.mocked(callRpc).mockResolvedValue({
      data: {
        order_id: "order-1",
        status: "refunded",
        order_number: "SF-001",
        total: 10,
        restock: {
          restocked: true,
          restock_movement_count: 1,
          restock_quantity_total: 2,
          credit_reversed: 4,
          reference_type: "order_refund",
        },
      },
      error: null,
    });

    const result = await refundOrderRpc({ orderId: "order-1", actorId: "user-1" });

    expect(callRpc).toHaveBeenCalledWith(
      "refund_order",
      expect.objectContaining({ p_order_id: "order-1", p_actor_id: "user-1" })
    );
    expect(result.restock.credit_reversed).toBe(4);
  });

  it("passes sales mode to expired-session override checkout", async () => {
    await completeCheckoutExpiredOverrideRpc(checkoutInput);

    expect(callRpc).toHaveBeenCalledWith(
      "complete_checkout_expired_override",
      expect.objectContaining({ p_sales_mode: "wholesale" })
    );
  });

  it("passes sales mode to split expired-session override checkout", async () => {
    await completeCheckoutSplitExpiredOverrideRpc({
      ...checkoutInput,
      payments: [
        { method: "cash", amount: 4 },
        { method: "card", amount: 6 },
      ],
    });

    expect(callRpc).toHaveBeenCalledWith(
      "complete_checkout_split_expired_override",
      expect.objectContaining({ p_sales_mode: "wholesale" })
    );
  });
});
