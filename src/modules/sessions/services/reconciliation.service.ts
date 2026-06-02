import * as sessionRepo from "@/lib/repositories/session.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";

export interface SessionReconciliation {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  expenses: number;
  expectedCash: number;
}

export async function calcExpectedCash(
  sessionId: string
): Promise<SessionReconciliation> {
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    return {
      openingCash: 0,
      cashSales: 0,
      cashRefunds: 0,
      expenses: 0,
      expectedCash: 0,
    };
  }

  const orders = (await orderRepo.listOrders(session.store_id)).filter(
    (o) => o.session_id === sessionId
  );
  const completedIds = new Set(
    orders.filter((o) => o.status === "completed").map((o) => o.id)
  );

  let cashSales = 0;
  for (const orderId of completedIds) {
    const payments = await orderRepo.getOrderPayments(orderId);
    cashSales += payments
      .filter((p) => p.method === "cash")
      .reduce((s, p) => s + p.amount, 0);
  }

  let cashRefunds = 0;
  for (const order of orders.filter((o) => o.status === "voided" || o.status === "refunded")) {
    const payments = await orderRepo.getOrderPayments(order.id);
    cashRefunds += payments
      .filter((p) => p.method === "cash")
      .reduce((s, p) => s + p.amount, 0);
  }

  const sessionExpenses = await expenseRepo.listExpenses({
    storeId: session.store_id,
    sessionId,
  });
  const expenses = sessionExpenses
    .filter(
      (e) =>
        e.expense_source === "session_cash" &&
        e.payment_method === "cash" &&
        e.status === "approved"
    )
    .reduce((s, e) => s + e.amount, 0);

  const expectedCash = session.opening_cash + cashSales - cashRefunds - expenses;

  return {
    openingCash: session.opening_cash,
    cashSales,
    cashRefunds,
    expenses,
    expectedCash,
  };
}

export function calcVariance(expected: number, actual: number) {
  return actual - expected;
}
