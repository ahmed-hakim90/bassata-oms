import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapMovement, mapStockLevel } from "@/lib/repositories/mappers";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import type { InventoryMovement, MovementType, StockLevel } from "@/lib/types";

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
  const db = await getDb();
  let q = db.from("stock_levels").select("*");
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
}): Promise<InventoryMovement | null> {
  if (!input.trackInventory) return null;
  const db = await getDb();
  const variantId = input.variantId ?? null;
  const current = await getStockLevel(input.storeId, input.warehouseId, input.productId, variantId);
  const preventNegativeStock = await isFeatureEnabled("prevent_negative_stock");
  if (preventNegativeStock && input.quantityDelta < 0 && current + input.quantityDelta < 0) {
    throw new Error(`Insufficient stock for ${input.productName}`);
  }

  let q = db
    .from("stock_levels")
    .select("*")
    .eq("store_id", input.storeId)
    .eq("warehouse_id", input.warehouseId)
    .eq("product_id", input.productId);
  if (variantId) q = q.eq("variant_id", variantId);
  else q = q.is("variant_id", null);
  const { data: level } = await q.maybeSingle();

  const newQty = (level?.quantity ?? 0) + input.quantityDelta;
  if (level) {
    const { error } = await db
      .from("stock_levels")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", level.id);
    if (error) throwDbError(error, "adjustStock.update");
  } else if (input.quantityDelta > 0) {
    const { error } = await db.from("stock_levels").insert({
      store_id: input.storeId,
      warehouse_id: input.warehouseId,
      product_id: input.productId,
      variant_id: variantId,
      quantity: newQty,
      reorder_point: 10,
    });
    if (error) throwDbError(error, "adjustStock.insert");
  }

  const { data: movement, error: movError } = await db
    .from("inventory_movements")
    .insert({
      store_id: input.storeId,
      warehouse_id: input.warehouseId,
      product_id: input.productId,
      variant_id: variantId,
      movement_type: input.movementType,
      quantity_delta: input.quantityDelta,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      reason: input.reason ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (movError || !movement) throwDbError(movError, "adjustStock.movement");
  return mapMovement(movement);
}

export async function listMovements(
  storeId?: string,
  warehouseId?: string,
  limit = 200
): Promise<InventoryMovement[]> {
  const db = await getDb();
  let q = db
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (storeId) q = q.eq("store_id", storeId);
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listMovements");
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
