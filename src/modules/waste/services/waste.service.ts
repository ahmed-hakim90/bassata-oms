import * as wasteRepo from "@/lib/repositories/waste.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { WASTE_REASONS } from "@/modules/waste/constants";
import type { WasteRecord } from "@/lib/types";

export interface WasteWithProduct extends WasteRecord {
  productName: string;
  warehouseName: string;
}

export async function listWasteWithProducts(storeId?: string): Promise<WasteWithProduct[]> {
  const records = await listWaste(storeId);
  const [products, warehouses] = await Promise.all([
    catalogRepo.listProducts(),
    warehouseRepo.listWarehouses(storeId),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  return records.map((r) => ({
    ...r,
    productName: productMap.get(r.product_id) ?? "Unknown",
    warehouseName: warehouseMap.get(r.warehouse_id) ?? "Unknown warehouse",
  }));
}

export function getWasteSummary(records: WasteWithProduct[]) {
  const byReasonMap = new Map<string, { count: number; units: number }>();
  for (const r of records) {
    const existing = byReasonMap.get(r.reason_code) ?? { count: 0, units: 0 };
    existing.count += 1;
    existing.units += r.quantity;
    byReasonMap.set(r.reason_code, existing);
  }
  const byReason = WASTE_REASONS.map((reason) => ({
    ...reason,
    count: byReasonMap.get(reason.code)?.count ?? 0,
    units: byReasonMap.get(reason.code)?.units ?? 0,
  }));
  return {
    totalUnits: records.reduce((s, r) => s + r.quantity, 0),
    recordCount: records.length,
    byReason,
  };
}

export async function listWaste(storeId?: string): Promise<WasteRecord[]> {
  return wasteRepo.listWaste(storeId);
}

export async function recordWaste(input: {
  storeId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  reasonCode: string;
  notes?: string;
  createdBy: string;
  batchId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
}): Promise<WasteRecord> {
  await assertPeriodOpen(input.storeId);
  await adjustStock({
    storeId: input.storeId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    variantId: input.variantId,
    quantityDelta: -input.quantity,
    movementType: "waste",
    referenceType: "waste_record",
    reason: input.reasonCode,
    createdBy: input.createdBy,
    batch: {
      batchNumber: input.batchNumber ?? null,
      expiryDate: input.expiryDate ?? null,
      sourceType: "adjustment",
    },
  });

  const record = await wasteRepo.createWaste({
    store_id: input.storeId,
    warehouse_id: input.warehouseId,
    product_id: input.productId,
    variant_id: input.variantId ?? null,
    quantity: input.quantity,
    batch_id: input.batchId ?? null,
    batch_number: input.batchNumber ?? null,
    expiry_date: input.expiryDate ?? null,
    reason_code: input.reasonCode,
    notes: input.notes ?? "",
    created_by: input.createdBy,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "waste.recorded",
    entityType: "waste",
    entityId: record.id,
  });

  return record;
}
