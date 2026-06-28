import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundOrder } from "@/modules/orders/services/order.service";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as customerAccountRepo from "@/lib/repositories/customer-account.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/order.repository");
vi.mock("@/lib/repositories/customer.repository");
vi.mock("@/lib/repositories/customer-account.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/services/audit.service", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(() => "org-1"),
}));
vi.mock("@/lib/services/period-lock.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/period-lock.service")>();
  return {
    ...actual,
    assertPeriodOpen: vi.fn(),
  };
});

describe("refundOrder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(warehouseRepo.getDefaultWarehouse).mockResolvedValue({
      id: "warehouse-1",
      org_id: "org-1",
      store_id: "store-1",
      name: "Main",
      is_default: true,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    vi.mocked(orderRepo.getOrderItems).mockResolvedValue([]);
    vi.mocked(orderRepo.getOrderDeductionsByOrderId).mockResolvedValue([]);
  });

  it("reverses customer ledger and balance for refunded credit sales", async () => {
    vi.mocked(orderRepo.getOrder).mockResolvedValue({
      id: "o1",
      store_id: "store-1",
      session_id: "s1",
      order_number: "SF-1",
      customer_id: "c1",
      status: "completed",
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      payment_status: "paid",
      created_by: "cashier-1",
      created_at: "2026-01-01T10:00:00Z",
    });
    vi.mocked(orderRepo.getOrderPayments).mockResolvedValue([
      { id: "pay-1", order_id: "o1", method: "credit", amount: 100, reference: null },
    ]);
    vi.mocked(customerRepo.getCustomer).mockResolvedValue({
      id: "c1",
      org_id: "org-1",
      name: "Mona",
      phone: "01000000000",
      email: null,
      total_spent: 100,
      visit_count: 1,
      account_balance: 100,
      credit_limit: 500,
      payment_terms: "",
      notes: "",
      created_at: new Date().toISOString(),
    });
    vi.mocked(orderRepo.updateOrderStatus).mockResolvedValue({
      id: "o1",
      store_id: "store-1",
      session_id: "s1",
      order_number: "SF-1",
      customer_id: "c1",
      status: "refunded",
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      payment_status: "paid",
      created_by: "cashier-1",
      created_at: "2026-01-01T10:00:00Z",
    });

    await refundOrder("o1", "manager-1");

    expect(customerAccountRepo.recordCustomerLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "c1",
        entryType: "refund",
        debit: 0,
        credit: 100,
        orderId: "o1",
      })
    );
    expect(customerRepo.updateCustomer).toHaveBeenCalledWith("c1", {
      account_balance: 0,
    });
  });
});
