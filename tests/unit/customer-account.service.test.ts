import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCustomerStatement,
  voidCustomerPayment,
} from "@/modules/customers/services/customer-account.service";
import { customerLedgerDisplayLabel } from "@/modules/customers/lib/ledger-type-labels";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as accountRepo from "@/lib/repositories/customer-account.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/lib/repositories/customer-account.repository");
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(() => "org-1"),
}));
vi.mock("@/lib/services/period-lock.service", () => ({
  assertPeriodOpen: vi.fn(),
}));
vi.mock("@/modules/accounting/services/gl-posting.service", () => ({
  safeReversePostedBySource: vi.fn(),
}));

describe("getCustomerStatement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("computes running balance from ledger entries", async () => {
    vi.mocked(customerRepo.getCustomer).mockResolvedValue({
      id: "c1",
      org_id: "o1",
      name: "Test",
      phone: "1",
      email: null,
      total_spent: 100,
      visit_count: 2,
      account_balance: 50,
      credit_limit: 200,
      payment_terms: "Net 30",
      notes: "",
      address: "",
      tax_id: "",
      created_at: new Date().toISOString(),
    });
    vi.mocked(accountRepo.listCustomerLedger).mockResolvedValue([
      {
        id: "l1",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "credit_sale",
        debit: 80,
        credit: 0,
        order_id: "o1",
        payment_id: null,
        reference: "SF-1",
        notes: "",
        created_by: "u1",
        created_at: "2026-01-01T10:00:00Z",
      },
      {
        id: "l2",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "payment_received",
        debit: 0,
        credit: 30,
        order_id: null,
        payment_id: "p1",
        reference: "",
        notes: "",
        created_by: "u1",
        created_at: "2026-01-02T10:00:00Z",
      },
    ]);

    const statement = await getCustomerStatement("c1");
    expect(statement?.closingBalance).toBe(50);
    expect(statement?.transactions).toHaveLength(2);
    expect(statement?.transactions[0]?.balance).toBe(80);
    expect(statement?.transactions[1]?.balance).toBe(50);
  });

  it("computes opening and closing balances for a historical range", async () => {
    vi.mocked(customerRepo.getCustomer).mockResolvedValue({
      id: "c1",
      org_id: "o1",
      name: "Test",
      phone: "1",
      email: null,
      total_spent: 100,
      visit_count: 2,
      account_balance: 60,
      credit_limit: 200,
      payment_terms: "Net 30",
      notes: "",
      address: "",
      tax_id: "",
      created_at: new Date().toISOString(),
    });
    vi.mocked(accountRepo.listCustomerLedger).mockResolvedValue([
      {
        id: "l1",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "credit_sale",
        debit: 100,
        credit: 0,
        order_id: "o1",
        payment_id: null,
        reference: "SF-1",
        notes: "",
        created_by: "u1",
        created_at: "2026-01-01T10:00:00Z",
      },
      {
        id: "l2",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "payment_received",
        debit: 0,
        credit: 25,
        order_id: null,
        payment_id: "p1",
        reference: "",
        notes: "",
        created_by: "u1",
        created_at: "2026-02-01T10:00:00Z",
      },
      {
        id: "l3",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "payment_received",
        debit: 0,
        credit: 15,
        order_id: null,
        payment_id: "p2",
        reference: "",
        notes: "",
        created_by: "u1",
        created_at: "2026-03-01T10:00:00Z",
      },
    ]);

    const statement = await getCustomerStatement("c1", {
      from: "2026-02-01",
      to: "2026-02-28",
    });

    expect(statement?.openingBalance).toBe(100);
    expect(statement?.closingBalance).toBe(75);
    expect(statement?.transactions).toHaveLength(1);
    expect(statement?.transactions[0]?.balance).toBe(75);
  });

  it("marks unvoided collections as voidable", async () => {
    vi.mocked(customerRepo.getCustomer).mockResolvedValue({
      id: "c1",
      org_id: "o1",
      name: "Test",
      phone: "1",
      email: null,
      total_spent: 100,
      visit_count: 2,
      account_balance: 50,
      credit_limit: 200,
      payment_terms: "Net 30",
      notes: "",
      address: "",
      tax_id: "",
      created_at: new Date().toISOString(),
    });
    vi.mocked(accountRepo.listCustomerLedger).mockResolvedValue([
      {
        id: "l2",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "payment_received",
        debit: 0,
        credit: 30,
        order_id: null,
        payment_id: "p1",
        reference: "",
        notes: "",
        created_by: "u1",
        created_at: "2026-01-02T10:00:00Z",
      },
      {
        id: "l3",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "adjustment",
        debit: 30,
        credit: 0,
        order_id: null,
        payment_id: "p1",
        reference: "",
        notes: "عكس تحصيل ملغي",
        created_by: "u1",
        created_at: "2026-01-03T10:00:00Z",
      },
      {
        id: "l4",
        org_id: "o1",
        store_id: "s1",
        customer_id: "c1",
        entry_type: "payment_received",
        debit: 0,
        credit: 20,
        order_id: null,
        payment_id: "p2",
        reference: "",
        notes: "",
        created_by: "u1",
        created_at: "2026-01-04T10:00:00Z",
      },
    ]);

    const statement = await getCustomerStatement("c1");
    const open = statement?.transactions.find((t) => t.paymentId === "p2");
    const voided = statement?.transactions.find((t) => t.id === "l2");
    const reverse = statement?.transactions.find((t) => t.id === "l3");
    expect(open?.canVoid).toBe(true);
    expect(voided?.canVoid).toBe(false);
    expect(reverse?.canVoid).toBe(false);
    expect(
      customerLedgerDisplayLabel({
        type: "adjustment",
        paymentId: "p1",
        debit: 30,
      })
    ).toBe("إلغاء تحصيل");
  });
});

describe("voidCustomerPayment", () => {
  const payment = {
    id: "p1",
    org_id: "o1",
    store_id: "s1",
    customer_id: "c1",
    amount: 40,
    payment_method: "cash" as const,
    reference: "",
    notes: "",
    received_at: "2026-08-17T00:00:00.000Z",
    created_by: "u1",
    created_at: "2026-08-17T00:00:00.000Z",
    voided_at: null,
    treasury_id: "tr-1",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("voids through the RPC then reverses the GL journal", async () => {
    const { safeReversePostedBySource } = await import(
      "@/modules/accounting/services/gl-posting.service"
    );
    vi.mocked(accountRepo.getCustomerPayment).mockResolvedValue(payment);
    vi.mocked(accountRepo.voidCustomerPaymentRpc).mockResolvedValue("p1");

    await voidCustomerPayment({ paymentId: "p1", userId: "u1" });

    expect(accountRepo.voidCustomerPaymentRpc).toHaveBeenCalledWith("p1");
    expect(safeReversePostedBySource).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSource: "customer_payment",
        originalSourceId: "p1",
        reverseSourceId: "customer-payment-void:p1",
      })
    );
  });

  it("does not call the RPC when the collection is already voided", async () => {
    vi.mocked(accountRepo.getCustomerPayment).mockResolvedValue({
      ...payment,
      voided_at: "2026-08-17T01:00:00.000Z",
    });

    await expect(voidCustomerPayment({ paymentId: "p1", userId: "u1" })).rejects.toThrow(
      /ملغي/
    );
    expect(accountRepo.voidCustomerPaymentRpc).not.toHaveBeenCalled();
  });
});
