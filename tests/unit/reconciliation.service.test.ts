import { describe, expect, it, vi, beforeEach } from "vitest";
import { calcExpectedCash, calcVariance } from "@/modules/sessions/services/reconciliation.service";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";

vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/expense.repository");
vi.mock("@/lib/repositories/supplier-payment.repository");

describe("calcVariance", () => {
  it("returns positive variance when actual exceeds expected", () => {
    expect(calcVariance(100, 105)).toBe(5);
  });

  it("returns negative variance when actual is short", () => {
    expect(calcVariance(100, 95)).toBe(-5);
  });
});

describe("calcExpectedCash", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("computes expected cash from opening, sales, refunds, expenses, and supplier cash payments", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "c1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 100,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(orderRepo.listOrdersBySessionIds).mockResolvedValue([
      {
        id: "o1",
        store_id: "store1",
        session_id: "s1",
        order_number: "1",
        customer_id: null,
        status: "completed",
        subtotal: 50,
        discount: 0,
        tax: 0,
        total: 50,
        payment_status: "paid",
        created_by: "c1",
        created_at: new Date().toISOString(),
      },
      {
        id: "o2",
        store_id: "store1",
        session_id: "s1",
        order_number: "2",
        customer_id: null,
        status: "refunded",
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        payment_status: "paid",
        created_by: "c1",
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(orderRepo.getOrderPaymentsForOrders).mockResolvedValue([
      { id: "p1", order_id: "o1", method: "cash", amount: 50, reference: null },
      { id: "p2", order_id: "o2", method: "cash", amount: 20, reference: null },
    ]);
    vi.mocked(expenseRepo.listExpenses).mockResolvedValue([
      {
        id: "e1",
        store_id: "store1",
        session_id: "s1",
        cost_center_id: "cc1",
        expense_category_id: "cat1",
        inventory_item_id: null,
        supplier_id: null,
        title: "Supplies",
        amount: 15,
        quantity: null,
        unit_cost: null,
        payment_method: "cash",
        expense_source: "session_cash",
        notes: "",
        receipt_url: null,
        status: "approved",
        approved_by: null,
        approved_at: null,
        created_by: "c1",
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(paymentRepo.listPaymentsForSessions).mockResolvedValue([
      {
        id: "sp1",
        org_id: "org1",
        store_id: "store1",
        supplier_id: "sup1",
        session_id: "s1",
        amount: 10,
        payment_method: "cash",
        reference: "",
        notes: "",
        paid_at: new Date().toISOString(),
        created_by: "c1",
        created_at: new Date().toISOString(),
        voided_at: null,
      },
      {
        id: "sp2",
        org_id: "org1",
        store_id: "store1",
        supplier_id: "sup1",
        session_id: "s1",
        amount: 5,
        payment_method: "card",
        reference: "",
        notes: "",
        paid_at: new Date().toISOString(),
        created_by: "c1",
        created_at: new Date().toISOString(),
        voided_at: null,
      },
    ]);

    const result = await calcExpectedCash("s1");

    expect(orderRepo.listOrdersBySessionIds).toHaveBeenCalledWith(["s1"]);
    expect(orderRepo.getOrderPaymentsForOrders).toHaveBeenCalledWith(["o1", "o2"]);
    expect(orderRepo.listOrders).not.toHaveBeenCalled();
    expect(orderRepo.getOrderPayments).not.toHaveBeenCalled();
    expect(result.openingCash).toBe(100);
    expect(result.cashSales).toBe(50);
    expect(result.cashRefunds).toBe(20);
    expect(result.expenses).toBe(15);
    expect(result.supplierPayments).toBe(10);
    expect(result.expectedCash).toBe(105);
    expect(result.totalSales).toBe(50);
    expect(result.orderCount).toBe(1);
  });
});
