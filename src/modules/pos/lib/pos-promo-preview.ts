import {
  evaluatePromotions,
  type EvaluatePromotionsResult,
  type PromotionRuleInput,
} from "@/modules/promotions/lib/evaluate-promotions";
import type { CartLine } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

export function previewPosPromotions(input: {
  rules: PromotionRuleInput[];
  cart: CartLine[];
  storeId?: string | null;
  saleMode?: SalesMode;
  couponCode?: string | null;
}): EvaluatePromotionsResult {
  return evaluatePromotions({
    rules: input.rules,
    lines: input.cart.map((line, index) => ({
      line_key: line.id || String(index),
      product_id: line.productId,
      category_id: line.categoryId ?? null,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    })),
    storeId: input.storeId,
    saleMode: input.saleMode ?? "retail",
    couponCode: input.couponCode,
  });
}
