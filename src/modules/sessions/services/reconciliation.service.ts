import * as sessionRepo from "@/lib/repositories/session.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import type { Expense } from "@/lib/types";

export interface SessionReconciliation {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  expenses: number;
  expectedCash: number;
}

export interface SessionCashBundle {
  reconciliation: SessionReconciliation;
  expenses: Expense[];
}

function emptyReconciliation(): SessionReconciliation {
  return {
    openingCash: 0,
    cashSales: 0,
    cashRefunds: 0,
    expenses: 0,
    expectedCash: 0,
  };
}

function sumCashPayments(
  payments: Awaited<ReturnType<typeof orderRepo.getOrderPaymentsForOrders>>
) {
  return payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
}

function approvedSessionCashExpenses(expenses: Expense[]) {
  return expenses
    .filter(
      (e) =>
        e.expense_source === "session_cash" &&
        e.payment_method === "cash" &&
        e.status === "approved"
    )
    .reduce((s, e) => s + e.amount, 0);
}

/** One session-scoped load for close-shift UI + expected cash. */
export async function loadSessionCashBundle(sessionId: string): Promise<SessionCashBundle> {
  const session = await sessionRepo.getSession(sessionId);
  if (!session) {
    return { reconciliation: emptyReconciliation(), expenses: [] };
  }

  const [orders, expenses] = await Promise.all([
    orderRepo.listOrdersBySessionIds([sessionId]),
    expenseRepo.listExpenses({
      storeId: session.store_id,
      sessionId,
    }),
  ]);

  const relevantIds = orders
    .filter(
      (o) =>
        o.status === "completed" || o.status === "voided" || o.status === "refunded"
    )
    .map((o) => o.id);

  const payments = await orderRepo.getOrderPaymentsForOrders(relevantIds);
  const paymentsByOrder = new Map<string, typeof payments>();
  for (const payment of payments) {
    const list = paymentsByOrder.get(payment.order_id) ?? [];
    list.push(payment);
    paymentsByOrder.set(payment.order_id, list);
  }

  let cashSales = 0;
  let cashRefunds = 0;
  for (const order of orders) {
    const cashTotal = sumCashPayments(paymentsByOrder.get(order.id) ?? []);
    if (order.status === "completed") {
      cashSales += cashTotal;
    } else if (order.status === "voided" || order.status === "refunded") {
      cashRefunds += cashTotal;
    }
  }

  const expenseTotal = approvedSessionCashExpenses(expenses);
  const expectedCash = session.opening_cash + cashSales - cashRefunds - expenseTotal;

  return {
    reconciliation: {
      openingCash: session.opening_cash,
      cashSales,
      cashRefunds,
      expenses: expenseTotal,
      expectedCash,
    },
    expenses,
  };
}

export async function calcExpectedCash(
  sessionId: string
): Promise<SessionReconciliation> {
  const { reconciliation } = await loadSessionCashBundle(sessionId);
  return reconciliation;
}

export function calcVariance(expected: number, actual: number) {
  return actual - expected;
}
