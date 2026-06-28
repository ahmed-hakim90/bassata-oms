import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupplierPayment } from "@/modules/suppliers/services/supplier.service";
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
