import { describe, expect, it } from "vitest";
import {
  buildProfitSnapshot,
  monthToDateRange,
  summarizeInventoryValuation,
  summarizePeriodSales,
  sumApprovedExpensesInRange,
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

describe("summarizeInventoryValuation", () => {
  it("computes sell, cost, and expected profit from on-hand qty", () => {
    const productMap = new Map([
      ["a", { base_price: 20, last_unit_cost: 12 }],
      ["b", { base_price: 10, last_unit_cost: 4 }],
    ]);
    const totals = summarizeInventoryValuation(
      [
        { product_id: "a", quantity: 5 },
        { product_id: "b", quantity: 10 },
        { product_id: "missing", quantity: 3 },
      ],
      productMap
    );
    expect(totals.inventorySellValue).toBe(200); // 5*20 + 10*10
    expect(totals.inventoryCostValue).toBe(100); // 5*12 + 10*4
    expect(totals.inventoryExpectedProfit).toBe(100);
  });
});

describe("sumApprovedExpensesInRange", () => {
  it("sums only approved expenses inside the range", () => {
    const total = sumApprovedExpensesInRange(
      [
        { amount: 50, status: "approved", created_at: "2026-07-02T10:00:00.000Z" },
        { amount: 20, status: "pending", created_at: "2026-07-03T10:00:00.000Z" },
        { amount: 30, status: "approved", created_at: "2026-06-30T23:00:00.000Z" },
        { amount: 15, status: "approved", created_at: "2026-07-14T12:00:00.000Z" },
      ],
      "2026-07-01T00:00:00.000Z",
      "2026-07-14T15:30:00.000Z"
    );
    expect(total).toBe(65);
  });
});

describe("buildProfitSnapshot", () => {
  it("subtracts MTD expenses from expected inventory profit", () => {
    expect(buildProfitSnapshot(100, 25)).toEqual({
      inventoryExpectedProfit: 100,
      expensesMtd: 25,
      profitAfterExpenses: 75,
    });
  });
});
