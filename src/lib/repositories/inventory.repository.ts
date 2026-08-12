import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapMovement, mapStockLevel } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import { calculateExpiryDate } from "@/lib/inventory/expiry";
import type { InventoryBatch, InventoryMovement, MovementType, StockLevel } from "@/lib/types";

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

interface BatchInput {
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
}

export async function getStockLevel(
  storeId: string,
  warehouseId: string,
  productId: string,
  variantId: string | null = null
): Promise<number> {
  const db = await getDb();
  let q = db
    .from("stock_levels")
    .select("quantity")
    .eq("store_id", storeId)
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId);
  if (variantId) q = q.eq("variant_id", variantId);
  else q = q.is("variant_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throwDbError(error, "getStockLevel");
  return data?.quantity ?? 0;
}

export async function listStockLevels(storeId?: string, warehouseId?: string): Promise<StockLevel[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (storeId && !storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db.from("stock_levels").select("*").in("store_id", storeIds);
  if (storeId) q = q.eq("store_id", storeId);
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listStockLevels");
  return (data ?? []).map(mapStockLevel);
}

export async function adjustStock(input: {
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
  trackInventory: boolean;
  productName: string;
  unit?: string;
  batch?: BatchInput;
  /** When set, skips a settings round-trip per movement. */
  preventNegativeStock?: boolean;
  /** Optional business timestamp for backdated documents. */
  createdAt?: string;
}): Promise<InventoryMovement | null> {
  if (!input.trackInventory) return null;
  const resolvedExpiryDate =
    input.batch?.expiryDate ??
    calculateExpiryDate(
      input.batch?.productionDate,
      input.batch?.shelfLifeValue,
      input.batch?.shelfLifeUnit
    ) ??
    null;
  const { data, error } = await callRpc<Record<string, unknown>>(
    "adjust_inventory_stock",
    {
      p_store_id: input.storeId,
      p_warehouse_id: input.warehouseId,
      p_product_id: input.productId,
      p_variant_id: input.variantId ?? null,
      p_quantity_delta: input.quantityDelta,
      p_movement_type: input.movementType,
      p_reference_type: input.referenceType ?? null,
      p_reference_id: input.referenceId ?? null,
      p_reason: input.reason ?? null,
      p_created_by: input.createdBy,
      p_prevent_negative: input.preventNegativeStock ?? false,
      p_batch_number: input.batch?.batchNumber?.trim() || null,
      p_batch_production_date: input.batch?.productionDate ?? null,
      p_batch_expiry_date: resolvedExpiryDate,
      p_batch_received_date: input.batch?.receivedDate ?? null,
      p_batch_supplier_id: input.batch?.supplierId ?? null,
      p_batch_purchase_invoice_id: input.batch?.purchaseInvoiceId ?? null,
      p_batch_source_type: input.batch?.sourceType ?? "adjustment",
      p_batch_source_document_id: input.batch?.sourceDocumentId ?? null,
      p_batch_unit: input.unit ?? "piece",
      p_created_at: input.createdAt ?? null,
    }
  );
  if (error || !data) {
    const message = error?.message ?? "تعذر تحديث المخزون";
    if (message.includes("Insufficient batch stock")) {
      throw new Error(`الرصيد غير كافٍ من التشغيلة للصنف ${input.productName}`);
    }
    if (message.includes("Insufficient stock")) {
      throw new Error(`الرصيد غير كافٍ للصنف ${input.productName}`);
    }
    throwDbError(error, "adjustStock");
  }
  return mapMovement(data as Parameters<typeof mapMovement>[0]);
}

export async function listInventoryBatches(
  storeId?: string,
  warehouseId?: string
): Promise<InventoryBatch[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (storeId && !storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db
    .from("inventory_batches")
    .select("*")
    .in("store_id", storeIds)
    .order("expiry_date", { ascending: true });
  if (storeId) q = q.eq("store_id", storeId);
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listInventoryBatches");
  return (data ?? []) as unknown as InventoryBatch[];
}

/** Batches for specific products only — used by POS checkout expiry checks. */
export async function listInventoryBatchesForProducts(
  storeId: string,
  warehouseId: string,
  productIds: string[]
): Promise<InventoryBatch[]> {
  if (productIds.length === 0) return [];
  const storeIds = await orgStoreIds();
  if (!storeIds.includes(storeId)) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("inventory_batches")
    .select("*")
    .eq("store_id", storeId)
    .eq("warehouse_id", warehouseId)
    .in("product_id", productIds)
    .order("expiry_date", { ascending: true });
  if (error) throwDbError(error, "listInventoryBatchesForProducts");
  return (data ?? []) as unknown as InventoryBatch[];
}

/** Batches created from a purchase invoice — used when voiding/reopening receipt. */
export async function listInventoryBatchesForPurchaseInvoice(
  purchaseInvoiceId: string
): Promise<InventoryBatch[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("inventory_batches")
    .select("*")
    .eq("purchase_invoice_id", purchaseInvoiceId)
    .order("created_at", { ascending: true });
  if (error) throwDbError(error, "listInventoryBatchesForPurchaseInvoice");
  return (data ?? []) as unknown as InventoryBatch[];
}

export async function listMovements(
  storeId?: string,
  warehouseId?: string,
  limit = 200,
  options?: {
    from?: string;
    to?: string;
    productId?: string;
    movementTypes?: MovementType[];
  }
): Promise<InventoryMovement[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (storeId && !storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db
    .from("inventory_movements")
    .select("*")
    .in("store_id", storeIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (storeId) q = q.eq("store_id", storeId);
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  if (options?.productId) q = q.eq("product_id", options.productId);
  if (options?.from) q = q.gte("created_at", options.from);
  if (options?.to) q = q.lte("created_at", options.to);
  if (options?.movementTypes && options.movementTypes.length > 0) {
    q = q.in("movement_type", options.movementTypes);
  }
  const { data, error } = await q;
  if (error) throwDbError(error, "listMovements");
  return (data ?? []).map(mapMovement);
}

const PRODUCT_MOVEMENT_PAGE = 1000;
const PRODUCT_MOVEMENT_MAX_ROWS = 20_000;

/**
 * All movements for one product up to `to` (inclusive), oldest first.
 * Used for period stock cards (opening + running balance).
 */
export async function listAllMovementsForProduct(options: {
  storeId: string;
  productId: string;
  warehouseId?: string;
  /** Inclusive upper bound (ISO). */
  to?: string;
}): Promise<InventoryMovement[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (!storeIds.includes(options.storeId)) return [];

  const db = await getDb();
  const rows: InventoryMovement[] = [];
  let from = 0;

  while (rows.length < PRODUCT_MOVEMENT_MAX_ROWS) {
    const to = from + PRODUCT_MOVEMENT_PAGE - 1;
    let q = db
      .from("inventory_movements")
      .select("*")
      .eq("store_id", options.storeId)
      .eq("product_id", options.productId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (options.warehouseId) q = q.eq("warehouse_id", options.warehouseId);
    if (options.to) q = q.lte("created_at", options.to);

    const { data, error } = await q;
    if (error) throwDbError(error, "listAllMovementsForProduct");
    const batch = (data ?? []).map(mapMovement);
    rows.push(...batch);
    if (batch.length < PRODUCT_MOVEMENT_PAGE) break;
    from += PRODUCT_MOVEMENT_PAGE;
  }

  return rows;
}

/** Movements for a single document (e.g. online_order reservation). */
export async function listMovementsByReference(
  referenceType: string,
  referenceId: string,
  movementTypes?: MovementType[]
): Promise<InventoryMovement[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];

  const db = await getDb();
  let q = db
    .from("inventory_movements")
    .select("*")
    .in("store_id", storeIds)
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .order("created_at", { ascending: true });
  if (movementTypes && movementTypes.length > 0) {
    q = q.in("movement_type", movementTypes);
  }
  const { data, error } = await q;
  if (error) throwDbError(error, "listMovementsByReference");
  return (data ?? []).map(mapMovement);
}

export async function isPeriodClosed(storeId: string, at: string): Promise<boolean> {
  const { data, error } = await callRpc<boolean>("is_period_closed", {
    p_store_id: storeId,
    p_at: at,
  });
  if (error) throwDbError(error, "isPeriodClosed");
  return Boolean(data);
}
