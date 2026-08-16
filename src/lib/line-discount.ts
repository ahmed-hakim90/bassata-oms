import { roundMoney } from "@/lib/money";

/** Gross line − capped discount (≥ 0). */
export function lineTotalAfterDiscount(
  quantity: number,
  unitAmount: number,
  discountAmount = 0
): number {
  const gross = roundMoney(Math.max(0, quantity) * Math.max(0, unitAmount));
  const discount = Math.max(0, Math.min(discountAmount, gross));
  return roundMoney(gross - discount);
}
