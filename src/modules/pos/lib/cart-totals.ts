import { roundMoney } from "@/lib/money";
import type { CartLine } from "@/lib/types";
import type { EvaluatePromotionsResult } from "@/modules/promotions/lib/evaluate-promotions";

export type PosCartTotals = {
  rawSubtotal: number;
  promoAdjustedSubtotal: number;
  promoCartDiscount: number;
  promoItemDiscount: number;
  /** Before loyalty redemption. */
  payableBeforeLoyalty: number;
  /** After loyalty redemption. */
  payableTotal: number;
};

export function rawCartSubtotal(cart: CartLine[]): number {
  return roundMoney(cart.reduce((sum, line) => sum + line.lineTotal, 0));
}

/**
 * Single source for POS cart money display + payment amounts.
 * Promo preview (when present) supplies adjusted subtotal / cart discount;
 * line `lineTotal` stays list price until checkout RPC.
 */
export function computePosCartTotals(input: {
  cart: CartLine[];
  discountAmount?: number;
  loyaltyAmount?: number;
  promoPreview?: EvaluatePromotionsResult | null;
}): PosCartTotals {
  const rawSubtotal = rawCartSubtotal(input.cart);
  const promo = input.promoPreview ?? null;
  const promoAdjustedSubtotal = promo ? roundMoney(promo.subtotal) : rawSubtotal;
  const promoCartDiscount = promo ? roundMoney(promo.cart_discount) : 0;
  const promoItemDiscount = promo
    ? roundMoney(promo.lines.reduce((sum, line) => sum + line.discount_amount, 0))
    : 0;
  const discountAmount = roundMoney(Math.max(0, input.discountAmount ?? 0));
  const loyaltyAmount = roundMoney(Math.max(0, input.loyaltyAmount ?? 0));
  const payableBeforeLoyalty = roundMoney(
    Math.max(0, promoAdjustedSubtotal - promoCartDiscount - discountAmount)
  );
  const payableTotal = roundMoney(Math.max(0, payableBeforeLoyalty - loyaltyAmount));

  return {
    rawSubtotal,
    promoAdjustedSubtotal,
    promoCartDiscount,
    promoItemDiscount,
    payableBeforeLoyalty,
    payableTotal,
  };
}
