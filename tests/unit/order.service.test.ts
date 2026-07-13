import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundOrder, voidOrder } from "@/modules/orders/services/order.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/store.repository");
vi.mock("@/lib/services/period-lock.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/period-lock.service")>();
  return {
    ...actual,
    assertPeriodOpen: vi.fn(),
  };
});

const completedOrder = {
  id: "o1",
  store_id: "store-1",
  session_id: "s1",
  order_number: "SF-1",
  customer_id: "c1",
  status: "completed" as const,
  subtotal: 100,
  discount: 0,
  tax: 0,
  total: 100,
  payment_status: "partial" as const,
  created_by: "cashier-1",
  created_at: "2026-01-01T10:00:00Z",
};

describe("refundOrder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("calls refund RPC and returns restock + partial credit reverse from RPC", async () => {
    vi.mocked(orderRepo.getOrder)
      .mockResolvedValueOnce(completedOrder)
      .mockResolvedValueOnce({ ...completedOrder, status: "refunded" });
    vi.mocked(orderRepo.refundOrderRpc).mockResolvedValue({
      order_id: "o1",
      status: "refunded",
      order_number: "SF-1",
      total: 100,
      restock: {
        restocked: true,
        restock_movement_count: 2,
        restock_quantity_total: 3,
        credit_reversed: 40,
        reference_type: "order_refund",
      },
    });

    const result = await refundOrder("o1", "manager-1");

    expect(orderRepo.refundOrderRpc).toHaveBeenCalledWith({
      orderId: "o1",
      actorId: "manager-1",
    });
    expect(result?.order.status).toBe("refunded");
    expect(result?.restock).toEqual({
      restocked: true,
      restockMovementCount: 2,
      restockQuantityTotal: 3,
      creditReversed: 40,
    });
  });

  it("maps feature-disabled refund errors for operators", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue(completedOrder);
    vi.mocked(orderRepo.refundOrderRpc).mockRejectedValue(
      new Error("Feature disabled: refunds")
    );

    await expect(refundOrder("o1", "manager-1")).rejects.toThrow("المرتجعات غير مفعلة");
  });
});

describe("voidOrder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("calls void RPC for stock reverse without app-side inventory math", async () => {
    vi.mocked(orderRepo.getOrder)
      .mockResolvedValueOnce(completedOrder)
      .mockResolvedValueOnce({ ...completedOrder, status: "voided" });
    vi.mocked(orderRepo.voidOrderRpc).mockResolvedValue({
      order_id: "o1",
      status: "voided",
      order_number: "SF-1",
      total: 100,
      restock: {
        restocked: true,
        restock_movement_count: 1,
        restock_quantity_total: 1,
        credit_reversed: 0,
        reference_type: "order_void",
      },
    });

    const result = await voidOrder("o1", "manager-1");

    expect(orderRepo.voidOrderRpc).toHaveBeenCalledWith({
      orderId: "o1",
      actorId: "manager-1",
    });
    expect(result?.restock.restocked).toBe(true);
  });
});
