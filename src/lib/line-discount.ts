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

export function sumLineDiscounts(
  items: Array<{ discount_amount?: number | null }>
): number {
  return roundMoney(
    items.reduce((sum, item) => sum + Math.max(0, Number(item.discount_amount ?? 0)), 0)
  );
}

/** Header discount + line discounts for the sales_discount GL account. */
export function glSaleDiscount(
  headerDiscount: number,
  items: Array<{ discount_amount?: number | null }>
): number {
  return roundMoney(Math.max(0, headerDiscount) + sumLineDiscounts(items));
}
