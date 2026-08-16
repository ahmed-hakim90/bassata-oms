import type { MovementType } from "@/lib/types";

/** Arabic labels for inventory movement types (ops UI). */
export const MOVEMENT_TYPE_LABELS_AR: Record<MovementType, string> = {
  sale: "بيع",
  purchase: "شراء",
  purchase_from_session: "شراء من جلسة",
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
  waste: "هالك",
  adjustment: "تسوية",
  stock_count: "جرد",
  reservation: "حجز",
  reservation_release: "إلغاء حجز",
};

export function aggregateMovementTypeCounts(
  movements: { movement_type: MovementType }[]
): { type: MovementType; label: string; count: number }[] {
  const counts = new Map<MovementType, number>();
  for (const m of movements) {
    counts.set(m.movement_type, (counts.get(m.movement_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: MOVEMENT_TYPE_LABELS_AR[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
