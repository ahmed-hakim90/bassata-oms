import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isReceiveTimeSupplierPayment,
  RECEIVE_TIME_PAYMENT_NOTES_PREFIX,
} from "@/modules/purchases/lib/receive-time-payment";
import { voidReceivedPurchase } from "@/modules/purchases/services/purchase.service";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import * as supplierService from "@/modules/suppliers/services/supplier.service";
import type { PurchaseInvoice, SupplierPayment } from "@/lib/types";

vi.mock("@/lib/repositories/purchase.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/lib/repositories/inventory.repository");
vi.mock("@/lib/repositories/supplier-payment.repository");
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(() => "org-1"),
}));
vi.mock("@/lib/services/period-lock.service", () => ({
  assertPeriodOpen: vi.fn(),
}));
vi.mock("@/lib/services/inventory-movement.service", () => ({
  adjustStock: vi.fn(),
  getStockLevel: vi.fn(),
}));
vi.mock("@/modules/system/services/settings.service", () => ({
  isFeatureEnabled: vi.fn(),
}));
vi.mock("@/modules/accounting/services/gl-posting.service", () => ({
  voidPostedBySource: vi.fn(),
}));
vi.mock("@/modules/suppliers/services/supplier.service", () => ({
  voidSupplierPayment: vi.fn(),
}));

const invoice: PurchaseInvoice = {
  id: "inv-1",
  store_id: "store-1",
  warehouse_id: "wh-1",
  supplier_id: "sup-1",
  invoice_number: "P-100",
  status: "received",
  document_kind: "purchase_invoice",
  subtotal: 100,
  extra_cost: 0,
  tax: 0,
  total: 100,
  document_date: "2026-08-19",
  received_at: "2026-08-19T10:00:00.000Z",
  cancelled_at: null,
  created_by: "u1",
  created_at: "2026-08-19T10:00:00.000Z",
};

function payment(partial: Partial<SupplierPayment>): SupplierPayment {
  return {
    id: "pay-1",
    org_id: "org-1",
    store_id: "store-1",
    supplier_id: "sup-1",
    session_id: null,
    amount: 40,
    payment_method: "cash",
    reference: "P-100",
    notes: `${RECEIVE_TIME_PAYMENT_NOTES_PREFIX} P-100`,
    paid_at: "2026-08-19T10:00:00.000Z",
    created_by: "u1",
    created_at: "2026-08-19T10:00:00.000Z",
    voided_at: null,
    ...partial,
  };
}

describe("isReceiveTimeSupplierPayment", () => {
  it("matches the receive RPC payment and ignores later supplier payments", () => {
    expect(isReceiveTimeSupplierPayment(payment({}), "P-100")).toBe(true);
    expect(
      isReceiveTimeSupplierPayment(
        payment({ notes: "سداد يدوي على الفاتورة", id: "pay-2" }),
        "P-100"
      )
    ).toBe(false);
    expect(
      isReceiveTimeSupplierPayment(payment({ voided_at: "2026-08-19T12:00:00.000Z" }), "P-100")
    ).toBe(false);
    expect(isReceiveTimeSupplierPayment(payment({ reference: "OTHER" }), "P-100")).toBe(false);
  });
});

describe("voidReceivedPurchase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(purchaseRepo.getPurchase).mockResolvedValue(invoice);
    vi.mocked(purchaseRepo.getPurchaseLines).mockResolvedValue([]);
    vi.mocked(purchaseRepo.updatePurchase).mockResolvedValue({
      ...invoice,
      status: "draft",
      received_at: null,
    });
    vi.mocked(inventoryRepo.listInventoryBatchesForPurchaseInvoice).mockResolvedValue([]);
    vi.mocked(paymentRepo.listPaymentsForStore).mockResolvedValue([
      payment({}),
      payment({
        id: "pay-later",
        notes: "سداد لاحق",
        amount: 20,
      }),
    ]);
    vi.mocked(supplierService.voidSupplierPayment).mockResolvedValue(
      payment({ voided_at: "2026-08-19T12:00:00.000Z" })
    );
  });

  it("voids the receive-time supplier payment and leaves later payments", async () => {
    await voidReceivedPurchase("inv-1", "u1");

    expect(supplierService.voidSupplierPayment).toHaveBeenCalledTimes(1);
    expect(supplierService.voidSupplierPayment).toHaveBeenCalledWith("pay-1", "u1");
    expect(purchaseRepo.updatePurchase).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ status: "draft", received_at: null })
    );
  });

  it("skips payment void when the invoice has no supplier", async () => {
    vi.mocked(purchaseRepo.getPurchase).mockResolvedValue({
      ...invoice,
      supplier_id: null,
    });

    await voidReceivedPurchase("inv-1", "u1");

    expect(paymentRepo.listPaymentsForStore).not.toHaveBeenCalled();
    expect(supplierService.voidSupplierPayment).not.toHaveBeenCalled();
  });
});
