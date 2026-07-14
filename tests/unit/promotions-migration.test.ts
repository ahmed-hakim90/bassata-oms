import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  "supabase/migrations/20260714210000_promotions_engine_v1.sql",
  "utf8"
);
const checkout = readFileSync(
  "supabase/migrations/20260714210001_promotions_checkout_wire.sql",
  "utf8"
);

describe("promotions engine migrations", () => {
  it("creates promotion_rules and evaluate_cart_promotions", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.promotion_rules");
    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.evaluate_cart_promotions");
    expect(schema).toContain("manage_promotions");
    expect(schema).toContain("'promotions', false");
  });

  it("wires complete_checkout with coupon and promo_discount", () => {
    expect(checkout).toContain("p_coupon_code TEXT DEFAULT NULL");
    expect(checkout).toContain("evaluate_cart_promotions");
    expect(checkout).toContain("promo_discount");
    expect(checkout).toContain("order_promotion_applications");
  });
});
