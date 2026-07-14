import { describe, expect, it } from "vitest";
import { computePosCartTotals, rawCartSubtotal } from "@/modules/pos/lib/cart-totals";
import type { CartLine } from "@/lib/types";
import type { EvaluatePromotionsResult } from "@/modules/promotions/lib/evaluate-promotions";

function line(partial: Partial<CartLine> & Pick<CartLine, "lineTotal">): CartLine {
  return {
    id: partial.id ?? "1",
    productId: partial.productId ?? "p1",
    variantId: partial.variantId ?? null,
    name: partial.name ?? "Item",
    quantity: partial.quantity ?? 1,
    unitPrice: partial.unitPrice ?? partial.lineTotal,
    modifiers: partial.modifiers ?? [],
    lineTotal: partial.lineTotal,
    imageUrl: partial.imageUrl ?? null,
  };
}

describe("computePosCartTotals", () => {
  it("uses raw cart subtotal when no promo preview", () => {
    const cart = [line({ lineTotal: 100 }), line({ id: "2", lineTotal: 50 })];
    expect(rawCartSubtotal(cart)).toBe(150);
    const totals = computePosCartTotals({ cart, discountAmount: 10 });
    expect(totals.payableBeforeLoyalty).toBe(140);
    expect(totals.payableTotal).toBe(140);
  });

  it("applies promo cart discount before manual discount and loyalty", () => {
    const cart = [line({ lineTotal: 100 })];
    const promoPreview: EvaluatePromotionsResult = {
      lines: [],
      subtotal: 90,
      cart_discount: 5,
      cart_rule_id: "r1",
      applications: [],
    };
    const totals = computePosCartTotals({
      cart,
      discountAmount: 10,
      loyaltyAmount: 5,
      promoPreview,
    });
    expect(totals.promoAdjustedSubtotal).toBe(90);
    expect(totals.promoCartDiscount).toBe(5);
    expect(totals.payableBeforeLoyalty).toBe(75);
    expect(totals.payableTotal).toBe(70);
  });
});
