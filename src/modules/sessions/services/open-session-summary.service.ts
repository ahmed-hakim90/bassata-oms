import * as orderRepo from "@/lib/repositories/order.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import { listOpenSessions } from "@/modules/sessions/services/session.service";
import {
  computeSessionLifecycle,
  formatSessionDuration,
} from "@/modules/sessions/services/session-lifecycle.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import type { CashierSession, OrderPayment, SessionLifecycleState } from "@/lib/types";

export interface OpenSessionSummary {
  session: CashierSession;
  cashierName: string;
  deviceName: string | null;
  storeName: string;
  openedAt: string;
  durationLabel: string;
  hoursOpen: number;
  lifecycle: SessionLifecycleState;
  blocksSales: boolean;
  orderCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  otherSales: number;
  sessionExpenses: number;
  supplierPayments: number;
  expectedCash: number;
  lastOrderAt: string | null;
}

function sumPayments(
  orderIds: Set<string>,
  payments: OrderPayment[],
  method: OrderPayment["method"]
) {
  return payments
    .filter((p) => orderIds.has(p.order_id) && p.method === method)
    .reduce((s, p) => s + p.amount, 0);
}

export async function getOpenSessionSummaries(input: {
  storeId?: string;
  storeMap: Map<string, string>;
  userMap: Map<string, string>;
  deviceMap: Map<string, string>;
}): Promise<OpenSessionSummary[]> {
  const [sessions, settings] = await Promise.all([
    listOpenSessions(input.storeId),
    getSessionSettings(),
  ]);
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const [orders, expenses, supplierPayments] = await Promise.all([
    orderRepo.listOrdersBySessionIds(sessionIds),
    expenseRepo.listExpensesBySessionIds(sessionIds),
    paymentRepo.listPaymentsForSessions(sessionIds),
  ]);

  const orderIds = orders.map((o) => o.id);
  const payments =
    orderIds.length > 0 ? await orderRepo.getOrderPaymentsForOrders(orderIds) : [];

  const ordersBySession = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.session_id) continue;
    const list = ordersBySession.get(order.session_id) ?? [];
    list.push(order);
    ordersBySession.set(order.session_id, list);
  }

  const expensesBySession = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    if (!expense.session_id) continue;
    const list = expensesBySession.get(expense.session_id) ?? [];
    list.push(expense);
    expensesBySession.set(expense.session_id, list);
  }

  const supplierPaymentsBySession = new Map<string, typeof supplierPayments>();
  for (const payment of supplierPayments) {
    if (!payment.session_id) continue;
    const list = supplierPaymentsBySession.get(payment.session_id) ?? [];
    list.push(payment);
    supplierPaymentsBySession.set(payment.session_id, list);
  }

  return sessions.map((session) => {
    const sessionOrders = ordersBySession.get(session.id) ?? [];
    const completedOrders = sessionOrders.filter((o) => o.status === "completed");
    const completedIds = new Set(completedOrders.map((o) => o.id));
    const refundedOrders = sessionOrders.filter(
      (o) => o.status === "voided" || o.status === "refunded"
    );
    const refundedIds = new Set(refundedOrders.map((o) => o.id));

    const cashSales = sumPayments(completedIds, payments, "cash");
    const cardSales = sumPayments(completedIds, payments, "card");
    const otherSales =
      sumPayments(completedIds, payments, "other") +
      sumPayments(completedIds, payments, "wallet") +
      sumPayments(completedIds, payments, "credit");
    const cashRefunds = sumPayments(refundedIds, payments, "cash");

    const sessionExpenseTotal = (expensesBySession.get(session.id) ?? [])
      .filter(
        (e) =>
          e.expense_source === "session_cash" &&
          e.payment_method === "cash" &&
          e.status === "approved"
      )
      .reduce((s, e) => s + e.amount, 0);

    const supplierPaymentTotal = (supplierPaymentsBySession.get(session.id) ?? [])
      .filter((p) => !p.voided_at && p.payment_method === "cash")
      .reduce((s, p) => s + p.amount, 0);

    const expectedCash =
      session.opening_cash +
      cashSales -
      cashRefunds -
      sessionExpenseTotal -
      supplierPaymentTotal;
    const totalSales = completedOrders.reduce((s, o) => s + o.total, 0);
    const lastOrderAt =
      sessionOrders.length > 0
        ? sessionOrders.reduce(
            (latest, o) => (o.created_at > latest ? o.created_at : latest),
            sessionOrders[0]!.created_at
          )
        : null;

    const lifecycleResult = computeSessionLifecycle(session, settings);

    return {
      session,
      cashierName: input.userMap.get(session.cashier_id) ?? "Unknown",
      deviceName: session.device_id
        ? (input.deviceMap.get(session.device_id) ?? null)
        : null,
      storeName: input.storeMap.get(session.store_id) ?? "Unknown",
      openedAt: session.opened_at,
      durationLabel: formatSessionDuration(lifecycleResult.hoursOpen),
      hoursOpen: lifecycleResult.hoursOpen,
      lifecycle: lifecycleResult.lifecycle,
      blocksSales: lifecycleResult.blocksSales,
      orderCount: completedOrders.length,
      totalSales,
      cashSales,
      cardSales,
      otherSales,
      sessionExpenses: sessionExpenseTotal,
      supplierPayments: supplierPaymentTotal,
      expectedCash,
      lastOrderAt,
    };
  });
}
