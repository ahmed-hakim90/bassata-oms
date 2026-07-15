import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupplierPayment,
  getSupplierStatement,
  listSupplierSummaries,
} from "@/modules/suppliers/services/supplier.service";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";

vi.mock("@/lib/repositories/purchase.repository");
vi.mock("@/lib/repositories/supplier-payment.repository");
vi.mock("@/lib/services/audit.service", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(() => "org-1"),
}));
vi.mock("@/lib/services/period-lock.service", () => ({
  assertPeriodOpen: vi.fn(),
}));

describe("createSupplierPayment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects credit as a supplier payment method", async () => {
    await expect(
      createSupplierPayment({
        storeId: "store-1",
        supplierId: "supplier-1",
        amount: 100,
        paymentMethod: "credit",
        createdBy: "user-1",
      })
    ).rejects.toThrow("Cannot record a supplier payment as credit");

    expect(purchaseRepo.getSupplier).not.toHaveBeenCalled();
    expect(paymentRepo.insertSupplierPayment).not.toHaveBeenCalled();
  });
});

describe("supplier opening balance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("includes opening_balance in listSupplierSummaries balanceDue", async () => {
    vi.mocked(purchaseRepo.listSuppliers).mockResolvedValue([
      {
        id: "s1",
        org_id: "org-1",
        name: "Supplier",
        contact_info: "",
        opening_balance: 500,
      },
    ]);
    vi.mocked(purchaseRepo.listPurchaseInvoicesForStore).mockResolvedValue([
      {
        id: "inv-1",
        store_id: "store-1",
        warehouse_id: "wh-1",
        supplier_id: "s1",
        invoice_number: "P-1",
        status: "received",
        subtotal: 200,
        extra_cost: 0,
        tax: 0,
        total: 200,
        document_date: "2026-07-01",
        received_at: "2026-07-01T00:00:00.000Z",
        cancelled_at: null,
        created_by: "u1",
        created_at: "2026-07-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(paymentRepo.listPaymentsForStore).mockResolvedValue([
      {
        id: "pay-1",
        org_id: "org-1",
        store_id: "store-1",
        supplier_id: "s1",
        session_id: null,
        amount: 100,
        payment_method: "cash",
        reference: "",
        notes: "",
        paid_at: "2026-07-02T00:00:00.000Z",
        created_by: "u1",
        created_at: "2026-07-02T00:00:00.000Z",
        voided_at: null,
      },
    ]);

    const rows = await listSupplierSummaries("store-1");
    expect(rows[0].balanceDue).toBe(600); // 500 + 200 - 100
  });

  it("seeds statement openingBalance with supplier opening_balance", async () => {
    vi.mocked(purchaseRepo.getSupplier).mockResolvedValue({
      id: "s1",
      org_id: "org-1",
      name: "Supplier",
      contact_info: "",
      opening_balance: 300,
    });
    vi.mocked(purchaseRepo.listPurchaseInvoicesForStore).mockResolvedValue([]);
    vi.mocked(paymentRepo.listPaymentsForStore).mockResolvedValue([]);

    const statement = await getSupplierStatement("s1", { storeId: "store-1" });
    expect(statement?.openingBalance).toBe(300);
    expect(statement?.closingBalance).toBe(300);
  });
});
