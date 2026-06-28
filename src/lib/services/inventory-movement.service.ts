import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { InventoryMovement, MovementType } from "@/lib/types";

export interface AdjustStockInput {
  storeId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantityDelta: number;
  movementType: MovementType;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdBy: string;
  batch?: {
    batchNumber?: string | null;
    productionDate?: string | null;
    expiryDate?: string | null;
    shelfLifeValue?: number | null;
    shelfLifeUnit?: "days" | "months" | "years" | null;
    receivedDate?: string | null;
    supplierId?: string | null;
    purchaseInvoiceId?: string | null;
    sourceType?: "purchase" | "opening_stock" | "transfer" | "production" | "adjustment";
    sourceDocumentId?: string | null;
  };
}

export async function getStockLevel(
  storeId: string,
  warehouseId: string,
  productId: string,
  variantId: string | null = null
): Promise<number> {
  return inventoryRepo.getStockLevel(storeId, warehouseId, productId, variantId);
}

export async function adjustStock(input: AdjustStockInput): Promise<InventoryMovement | null> {
  await assertPeriodOpen(input.storeId);
  const warehouse = await warehouseRepo.getWarehouse(input.warehouseId);
  if (!warehouse || warehouse.store_id !== input.storeId || !warehouse.is_active) {
    throw new Error("Warehouse does not belong to the selected store");
  }
  const product = await catalogRepo.getProduct(input.productId);
  if (!product?.track_inventory) return null;

  const movement = await inventoryRepo.adjustStock({
    ...input,
    trackInventory: product.track_inventory,
    productName: product.name,
    unit: product.base_unit ?? product.unit,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "stock.adjusted",
    entityType: "stock_level",
    entityId: `${input.warehouseId}:${input.productId}`,
    metadata: {
      warehouseId: input.warehouseId,
      quantityDelta: input.quantityDelta,
      movementType: input.movementType,
      batchNumber: input.batch?.batchNumber ?? null,
    },
  });

  return movement;
}
