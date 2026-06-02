import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
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
  const product = await catalogRepo.getProduct(input.productId);
  if (!product?.track_inventory) return null;

  const movement = await inventoryRepo.adjustStock({
    ...input,
    trackInventory: product.track_inventory,
    productName: product.name,
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
    },
  });

  return movement;
}
