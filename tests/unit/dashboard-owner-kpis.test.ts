import { describe, expect, it } from "vitest";
import {
  monthToDateRange,
  summarizePeriodSales,
} from "@/modules/dashboard/services/dashboard.service";
import type { Order } from "@/lib/types";

function makeOrder(
  partial: Partial<Order> &
    Pick<Order, "id" | "total" | "payment_status" | "status">
): Order {
  return {
    store_id: "store-1",
    session_id: "sess-1",
    order_number: partial.id,
    customer_id: null,
    subtotal: partial.total,
    discount: 0,
    tax: 0,
    created_by: "u1",
    created_at: "2026-07-10T12:00:00.000Z",
    ...partial,
  };
}

describe("monthToDateRange", () => {
  it("starts at UTC first of month", () => {
    const range = monthToDateRange(new Date("2026-07-14T15:30:00.000Z"));
    expect(range.from).toBe("2026-07-01T00:00:00.000Z");
    expect(range.to).toBe("2026-07-14T15:30:00.000Z");
  });
});

describe("summarizePeriodSales", () => {
  it("excludes unpaid completed orders", () => {
    const summary = summarizePeriodSales([
      makeOrder({ id: "1", total: 100, status: "completed", payment_status: "paid" }),
      makeOrder({ id: "2", total: 50, status: "completed", payment_status: "unpaid" }),
      makeOrder({ id: "3", total: 20, status: "voided", payment_status: "paid" }),
      makeOrder({ id: "4", total: 30, status: "completed", payment_status: "partial" }),
    ]);
    expect(summary.revenue).toBe(130);
    expect(summary.orderCount).toBe(2);
    expect(summary.avgTicket).toBe(65);
  });
});
