import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftPurchase } from "@/modules/purchases/services/purchase.service";
import { createDraftTransfer } from "@/modules/transfers/services/transfer.service";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as transferRepo from "@/lib/repositories/transfer.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/purchase.repository");
vi.mock("@/lib/repositories/transfer.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/inventory.repository");
vi.mock("@/lib/repositories/store.repository");
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({ getOrgId: vi.fn() }));
vi.mock("@/lib/services/period-lock.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/period-lock.service")>();
  return {
    ...actual,
    assertPeriodOpen: vi.fn(),
  };
});

const warehouse = {
  id: "warehouse-2",
  org_id: "org-1",
  store_id: "store-2",
  name: "Other Store Warehouse",
  is_default: true,
  is_active: true,
  created_at: new Date().toISOString(),
};

describe("warehouse/store validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(warehouseRepo.getWarehouse).mockResolvedValue(warehouse);
  });

  it("rejects draft purchases when the warehouse belongs to another store", async () => {
    await expect(
      createDraftPurchase({
        storeId: "store-1",
        warehouseId: "warehouse-2",
        supplierId: "supplier-1",
        invoiceNumber: "INV-1",
        createdBy: "user-1",
      })
    ).rejects.toThrow("Warehouse does not belong to the selected store");

    expect(purchaseRepo.insertPurchase).not.toHaveBeenCalled();
  });

  it("rejects draft transfers when a warehouse does not match its store", async () => {
    await expect(
      createDraftTransfer({
        fromStoreId: "store-1",
        toStoreId: "store-2",
        fromWarehouseId: "warehouse-2",
        toWarehouseId: "warehouse-3",
        createdBy: "user-1",
      })
    ).rejects.toThrow("Warehouse does not belong to the selected store");

    expect(transferRepo.insertTransfer).not.toHaveBeenCalled();
  });

  it("rejects stock adjustments when the warehouse belongs to another store", async () => {
    await expect(
      adjustStock({
        storeId: "store-1",
        warehouseId: "warehouse-2",
        productId: "product-1",
        quantityDelta: 1,
        movementType: "adjustment",
        createdBy: "user-1",
      })
    ).rejects.toThrow("Warehouse does not belong to the selected store");

    expect(catalogRepo.getProduct).not.toHaveBeenCalled();
    expect(inventoryRepo.adjustStock).not.toHaveBeenCalled();
  });
});
