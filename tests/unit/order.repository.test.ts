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
