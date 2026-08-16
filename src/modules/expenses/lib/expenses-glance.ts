import type { Expense, ExpenseStatus } from "@/lib/types";

export type ExpensesGlance = {
  totalAmount: number;
  approvedAmount: number;
  pendingCount: number;
  approvedCount: number;
  rowCount: number;
  categoryChart: { label: string; amount: number }[];
  monthlyChart: { label: string; amount: number }[];
};

/**
 * Pure glance from already-loaded expense rows + category names.
 * No second DB round-trip — matches the filters the operator already applied.
 */
export function buildExpensesGlance(input: {
  expenses: Pick<
    Expense,
    "amount" | "status" | "expense_category_id" | "created_at"
  >[];
  categoryNames: Record<string, string>;
}): ExpensesGlance {
  let totalAmount = 0;
  let approvedAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;

  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, number>();

  for (const expense of input.expenses) {
    totalAmount += expense.amount;
    const status = expense.status as ExpenseStatus;
    if (status === "approved") {
      approvedAmount += expense.amount;
      approvedCount += 1;
      byCategory.set(
        expense.expense_category_id,
        (byCategory.get(expense.expense_category_id) ?? 0) + expense.amount
      );
      const monthKey = expense.created_at.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + expense.amount);
    } else if (status === "pending") {
      pendingCount += 1;
    }
  }

  const categoryChart = [...byCategory.entries()]
    .map(([id, amount]) => ({
      label: (input.categoryNames[id] ?? "تصنيف").slice(0, 14),
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const monthlyChart = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, amount]) => ({
      label: formatMonthLabel(key),
      amount: Math.round(amount * 100) / 100,
    }));

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    approvedAmount: Math.round(approvedAmount * 100) / 100,
    pendingCount,
    approvedCount,
    rowCount: input.expenses.length,
    categoryChart,
    monthlyChart,
  };
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(date.getTime())) return yyyyMm;
  return date.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
}
