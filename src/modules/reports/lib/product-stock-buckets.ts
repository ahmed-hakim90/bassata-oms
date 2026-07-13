import type { MovementType } from "@/lib/types";

/** وارد: شراء / تحويل وارد / فك حجز */
export const STOCK_CARD_IN_TYPES = new Set<MovementType>([
  "purchase",
  "purchase_from_session",
  "transfer_in",
  "reservation_release",
]);

/** منصرف: بيع / هدر / تحويل صادر / حجز */
export const STOCK_CARD_OUT_TYPES = new Set<MovementType>([
  "sale",
  "waste",
  "transfer_out",
  "reservation",
]);

/** تسوية: تعديل يدوي / جرد */
export const STOCK_CARD_EQUALIZE_TYPES = new Set<MovementType>([
  "adjustment",
  "stock_count",
]);

export type StockCardBucket = "in" | "out" | "equalize";

export function classifyStockCardMovement(
  type: MovementType,
  quantityDelta: number
): StockCardBucket {
  if (STOCK_CARD_EQUALIZE_TYPES.has(type)) return "equalize";
  if (STOCK_CARD_IN_TYPES.has(type)) return "in";
  if (STOCK_CARD_OUT_TYPES.has(type)) return "out";
  // Fallback by sign for unexpected types
  if (quantityDelta >= 0) return "in";
  return "out";
}

export const STOCK_CARD_TYPE_LABELS_AR: Record<MovementType, string> = {
  sale: "بيع",
  purchase: "شراء",
  purchase_from_session: "شراء من جلسة",
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
  waste: "هدر",
  adjustment: "تعديل",
  stock_count: "جرد",
  reservation: "حجز",
  reservation_release: "فك حجز",
};

export const STOCK_CARD_BUCKET_LABELS_AR: Record<StockCardBucket, string> = {
  in: "جه",
  out: "طلع",
  equalize: "اتساوى",
};
