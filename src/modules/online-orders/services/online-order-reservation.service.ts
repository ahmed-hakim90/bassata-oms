import { callRpc, throwDbError } from "@/lib/repositories/client";
import type { OnlineOrder } from "@/lib/types";

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

/** Hold stock on online accept (movement_type = reservation). */
export async function reserveStockForOnlineOrder(
  order: OnlineOrder,
  userId: string
): Promise<void> {
  const { error } = await callRpc("set_online_order_reservation", {
    p_online_order_id: order.id,
    p_reserve: true,
    p_actor_id: userId,
  });
  if (error) {
    if (error.message.includes("Insufficient stock")) {
      throw new Error(
        "لا يمكن قبول الطلب: المخزون غير كافٍ للحجز (إعداد منع المخزون السالب مفعّل)"
      );
    }
    throwDbError(error, "reserveStockForOnlineOrder");
  }
}

/** Release held stock on cancel or before sale invoicing. */
export async function releaseStockForOnlineOrder(
  order: OnlineOrder,
  userId: string,
  reason = "تحرير حجز طلب أونلاين"
): Promise<void> {
  void reason;
  const { error } = await callRpc("set_online_order_reservation", {
    p_online_order_id: order.id,
    p_reserve: false,
    p_actor_id: userId,
  });
  if (error) throwDbError(error, "releaseStockForOnlineOrder");
}
