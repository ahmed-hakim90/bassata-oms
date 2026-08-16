import { describe, expect, it } from "vitest";
import { buildExpensesGlance } from "@/modules/expenses/lib/expenses-glance";
import type { ExpenseStatus } from "@/lib/types";

function expense(input: {
  amount: number;
  status: ExpenseStatus;
  categoryId: string;
  createdAt: string;
}) {
  return {
    amount: input.amount,
    status: input.status,
    expense_category_id: input.categoryId,
    created_at: input.createdAt,
  };
}

describe("buildExpensesGlance", () => {
  it("aggregates approved by category and month from loaded rows", () => {
    const glance = buildExpensesGlance({
      expenses: [
        expense({
          amount: 100,
          status: "approved",
          categoryId: "c1",
          createdAt: "2026-07-10T12:00:00.000Z",
        }),
        expense({
          amount: 50,
          status: "approved",
          categoryId: "c1",
          createdAt: "2026-08-01T12:00:00.000Z",
        }),
        expense({
          amount: 20,
          status: "pending",
          categoryId: "c2",
          createdAt: "2026-08-02T12:00:00.000Z",
        }),
      ],
      categoryNames: { c1: "كهرباء", c2: "نظافة" },
    });

    expect(glance.approvedAmount).toBe(150);
    expect(glance.pendingCount).toBe(1);
    expect(glance.rowCount).toBe(3);
    expect(glance.totalAmount).toBe(170);
    expect(glance.categoryChart).toEqual([{ label: "كهرباء", amount: 150 }]);
    expect(glance.monthlyChart.length).toBe(2);
  });
});
