import { describe, expect, it, vi, beforeEach } from "vitest";
import { getCustomerStatement } from "@/modules/customers/services/customer-account.service";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as accountRepo from "@/lib/repositories/customer-account.repository";

vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/lib/repositories/customer-account.repository");

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
});
