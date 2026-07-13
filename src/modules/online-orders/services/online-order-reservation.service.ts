import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as onlineOrderRepo from "@/lib/repositories/online-order.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import type { OnlineOrder } from "@/lib/types";

const ONLINE_ORDER_REF = "online_order";

/**
 * Net reserved qty per product/variant for an online order
 * (reservation − reservation_release). Idempotent helpers use this.
 *
 * reservation qty_delta is negative; release is positive → held = max(0, −ΣΔ).
 */
export function netReservedByLine(
  movements: {
    movement_type: string;
    product_id: string;
    variant_id: string | null;
    quantity_delta: number;
  }[]
): Map<string, number> {
  const sumDelta = new Map<string, number>();
  for (const m of movements) {
    if (m.movement_type !== "reservation" && m.movement_type !== "reservation_release") {
      continue;
    }
    const key = `${m.product_id}:${m.variant_id ?? ""}`;
    sumDelta.set(key, (sumDelta.get(key) ?? 0) + m.quantity_delta);
  }
  const held = new Map<string, number>();
  for (const [key, delta] of sumDelta) {
    held.set(key, Math.max(0, -delta));
  }
  return held;
}

async function resolveWarehouseId(storeId: string): Promise<string> {
  const warehouse = await warehouseRepo.getDefaultWarehouse(storeId);
  if (!warehouse) {
    throw new Error("لا يوجد مخزن افتراضي للفرع لحجز المخزون");
  }
  return warehouse.id;
}

/** Hold stock on online accept (movement_type = reservation). */
export async function reserveStockForOnlineOrder(
  order: OnlineOrder,
  userId: string
): Promise<void> {
  const existing = await inventoryRepo.listMovementsByReference(ONLINE_ORDER_REF, order.id, [
    "reservation",
    "reservation_release",
  ]);
  const currentlyHeld = netReservedByLine(existing);
  // Already fully reserved (any positive hold) and no items to add — skip.
  const items = await onlineOrderRepo.getOnlineOrderItems(order.id);
  const warehouseId = await resolveWarehouseId(order.store_id);

  for (const item of items) {
    const key = `${item.product_id}:${item.variant_id ?? ""}`;
    const already = currentlyHeld.get(key) ?? 0;
    const need = item.quantity - already;
    if (need <= 0) continue;

    try {
      await adjustStock({
        storeId: order.store_id,
        warehouseId,
        productId: item.product_id,
        variantId: item.variant_id,
        quantityDelta: -need,
        movementType: "reservation",
        referenceType: ONLINE_ORDER_REF,
        referenceId: order.id,
        reason: `حجز طلب أونلاين #${order.id.slice(-6).toUpperCase()}`,
        createdBy: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Insufficient stock")) {
        throw new Error(
          "لا يمكن قبول الطلب: المخزون غير كافٍ للحجز (إعداد منع المخزون السالب مفعّل)"
        );
      }
      throw error;
    }
  }
}

/** Release held stock on cancel or before sale invoicing. */
export async function releaseStockForOnlineOrder(
  order: OnlineOrder,
  userId: string,
  reason = "تحرير حجز طلب أونلاين"
): Promise<void> {
  const existing = await inventoryRepo.listMovementsByReference(ONLINE_ORDER_REF, order.id, [
    "reservation",
    "reservation_release",
  ]);
  const currentlyHeld = netReservedByLine(existing);
  if (currentlyHeld.size === 0) return;

  const warehouseId =
    existing[0]?.warehouse_id ?? (await resolveWarehouseId(order.store_id));

  for (const [key, held] of currentlyHeld) {
    if (held <= 0) continue;
    const [productId, variantPart] = key.split(":");
    await adjustStock({
      storeId: order.store_id,
      warehouseId,
      productId,
      variantId: variantPart ? variantPart : null,
      quantityDelta: held,
      movementType: "reservation_release",
      referenceType: ONLINE_ORDER_REF,
      referenceId: order.id,
      reason: `${reason} #${order.id.slice(-6).toUpperCase()}`,
      createdBy: userId,
    });
  }
}
