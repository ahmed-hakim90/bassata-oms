import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraftPurchase,
  nextPurchaseInvoiceNumber,
} from "@/modules/purchases/services/purchase.service";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as periodLock from "@/lib/services/period-lock.service";
import * as auditService from "@/lib/services/audit.service";
import * as orgRepo from "@/lib/repositories/organization.repository";

vi.mock("@/lib/repositories/purchase.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/lib/services/period-lock.service");
vi.mock("@/lib/services/audit.service");
vi.mock("@/lib/repositories/organization.repository");

describe("nextPurchaseInvoiceNumber", () => {
  it("formats PI-YYYYMMDD-NNNN from document date and day count", () => {
    expect(nextPurchaseInvoiceNumber("2026-08-12", 0)).toBe("PI-20260812-0001");
    expect(nextPurchaseInvoiceNumber("2026-08-12", 11)).toBe("PI-20260812-0012");
  });
});

describe("createDraftPurchase invoice numbering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(periodLock.assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(orgRepo.getOrgId).mockResolvedValue("org1");
    vi.mocked(auditService.writeAuditLog).mockResolvedValue(undefined as never);
    vi.mocked(warehouseRepo.getWarehouse).mockResolvedValue({
      id: "wh1",
      store_id: "store1",
      name: "Main",
      is_default: true,
      is_active: true,
      created_at: new Date().toISOString(),
    } as never);
  });

  it("auto-generates invoice number when omitted", async () => {
    vi.mocked(purchaseRepo.countPurchasesOnDocumentDate).mockResolvedValue(2);
    vi.mocked(purchaseRepo.insertPurchase).mockResolvedValue({
      id: "pi1",
      store_id: "store1",
      warehouse_id: "wh1",
      supplier_id: "s1",
      invoice_number: "PI-20260812-0003",
      status: "draft",
      subtotal: 0,
      extra_cost: 0,
      tax: 0,
      total: 0,
      document_date: "2026-08-12",
      received_at: null,
      cancelled_at: null,
      created_by: "u1",
      created_at: new Date().toISOString(),
    } as never);

    await createDraftPurchase({
      storeId: "store1",
      warehouseId: "wh1",
      supplierId: "s1",
      createdBy: "u1",
      documentDate: "2026-08-12",
    });

    expect(purchaseRepo.countPurchasesOnDocumentDate).toHaveBeenCalledWith(
      "store1",
      "2026-08-12"
    );
    expect(purchaseRepo.insertPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ invoice_number: "PI-20260812-0003" }),
      []
    );
  });

  it("keeps an explicit invoice number when provided", async () => {
    vi.mocked(purchaseRepo.insertPurchase).mockResolvedValue({
      id: "pi1",
      store_id: "store1",
      warehouse_id: "wh1",
      supplier_id: "s1",
      invoice_number: "SUP-99",
      status: "draft",
      subtotal: 0,
      extra_cost: 0,
      tax: 0,
      total: 0,
      document_date: "2026-08-12",
      received_at: null,
      cancelled_at: null,
      created_by: "u1",
      created_at: new Date().toISOString(),
    } as never);

    await createDraftPurchase({
      storeId: "store1",
      warehouseId: "wh1",
      supplierId: "s1",
      invoiceNumber: "SUP-99",
      createdBy: "u1",
      documentDate: "2026-08-12",
    });

    expect(purchaseRepo.countPurchasesOnDocumentDate).not.toHaveBeenCalled();
    expect(purchaseRepo.insertPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ invoice_number: "SUP-99" }),
      []
    );
  });
});
