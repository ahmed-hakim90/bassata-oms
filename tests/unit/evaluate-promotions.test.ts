import { describe, expect, it } from "vitest";
import {
  evaluatePromotions,
  type PromotionRuleInput,
} from "@/modules/promotions/lib/evaluate-promotions";

function rule(partial: Partial<PromotionRuleInput> & Pick<PromotionRuleInput, "id" | "rule_type" | "name">): PromotionRuleInput {
  return {
    is_active: true,
    priority: 0,
    starts_at: null,
    ends_at: null,
    store_ids: null,
    sale_modes: ["retail", "wholesale"],
    coupon_code: null,
    stackable_with_cart: false,
    min_subtotal: 0,
    scope_type: "all",
    scope_ids: [],
    config: {},
    usage_limit_total: null,
    usage_count: 0,
    ...partial,
  };
}

describe("evaluatePromotions", () => {
  it("applies percent_off_item on matching product", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "r1",
          name: "20% drinks",
          rule_type: "percent_off_item",
          scope_type: "product",
          scope_ids: ["p1"],
          config: { percent: 20 },
        }),
      ],
      lines: [
        { line_key: "0", product_id: "p1", category_id: "c1", quantity: 2, unit_price: 50 },
        { line_key: "1", product_id: "p2", category_id: "c1", quantity: 1, unit_price: 30 },
      ],
    });
    expect(result.lines[0].discount_amount).toBe(20);
    expect(result.lines[0].line_total).toBe(80);
    expect(result.lines[1].discount_amount).toBe(0);
    expect(result.cart_discount).toBe(0);
    expect(result.subtotal).toBe(110);
  });

  it("applies fixed_off_item capped by line gross", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "r1",
          name: "fixed",
          rule_type: "fixed_off_item",
          scope_type: "all",
          config: { amount: 15 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 10 }],
    });
    expect(result.lines[0].discount_amount).toBe(10);
    expect(result.lines[0].line_total).toBe(0);
  });

  it("applies scheduled_sale_price before item percent", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "sched",
          name: "sale",
          rule_type: "scheduled_sale_price",
          priority: 10,
          scope_type: "product",
          scope_ids: ["p1"],
          config: { sale_price: 40 },
        }),
        rule({
          id: "pct",
          name: "10%",
          rule_type: "percent_off_item",
          priority: 1,
          scope_type: "product",
          scope_ids: ["p1"],
          config: { percent: 10 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 100 }],
    });
    expect(result.lines[0].list_unit_price).toBe(40);
    expect(result.lines[0].discount_amount).toBe(4);
    expect(result.lines[0].line_total).toBe(36);
  });

  it("picks best item discount when multiple apply", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "a",
          name: "10%",
          rule_type: "percent_off_item",
          priority: 1,
          config: { percent: 10 },
        }),
        rule({
          id: "b",
          name: "25 fixed",
          rule_type: "fixed_off_item",
          priority: 1,
          config: { amount: 25 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 100 }],
    });
    expect(result.lines[0].discount_amount).toBe(25);
    expect(result.lines[0].promotion_rule_id).toBe("b");
  });

  it("applies cart_percent with min_subtotal", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "cart",
          name: "cart 10",
          rule_type: "cart_percent",
          min_subtotal: 100,
          config: { percent: 10 },
        }),
      ],
      lines: [
        { line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 80 },
      ],
    });
    expect(result.cart_discount).toBe(0);

    const result2 = evaluatePromotions({
      rules: [
        rule({
          id: "cart",
          name: "cart 10",
          rule_type: "cart_percent",
          min_subtotal: 100,
          config: { percent: 10 },
        }),
      ],
      lines: [
        { line_key: "0", product_id: "p1", category_id: null, quantity: 2, unit_price: 80 },
      ],
    });
    expect(result2.subtotal).toBe(160);
    expect(result2.cart_discount).toBe(16);
  });

  it("applies bogo buy 2 get 1 free", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "bogo",
          name: "bogo",
          rule_type: "bogo",
          config: { buy_qty: 2, get_qty: 1, get_percent: 100 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 3, unit_price: 10 }],
    });
    expect(result.lines[0].discount_amount).toBe(10);
    expect(result.lines[0].line_total).toBe(20);
  });

  it("applies qty_threshold percent", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "qty",
          name: "qty",
          rule_type: "qty_threshold",
          config: { min_qty: 5, percent: 15 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 4, unit_price: 10 }],
    });
    expect(result.lines[0].discount_amount).toBe(0);

    const result2 = evaluatePromotions({
      rules: [
        rule({
          id: "qty",
          name: "qty",
          rule_type: "qty_threshold",
          config: { min_qty: 5, percent: 15 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 5, unit_price: 10 }],
    });
    expect(result2.lines[0].discount_amount).toBe(7.5);
  });

  it("requires coupon code for coupon-gated rules", () => {
    const rules = [
      rule({
        id: "coup",
        name: "SAVE10",
        rule_type: "cart_fixed",
        coupon_code: "SAVE10",
        config: { amount: 10 },
      }),
    ];
    const lines = [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 50 }];
    expect(evaluatePromotions({ rules, lines }).cart_discount).toBe(0);
    expect(evaluatePromotions({ rules, lines, couponCode: "save10" }).cart_discount).toBe(10);
  });

  it("coupon cart rule wins over auto cart unless stackable prefers larger", () => {
    const rules = [
      rule({
        id: "auto",
        name: "auto",
        rule_type: "cart_fixed",
        config: { amount: 20 },
      }),
      rule({
        id: "coup",
        name: "coup",
        rule_type: "cart_fixed",
        coupon_code: "X",
        config: { amount: 5 },
      }),
    ];
    const lines = [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 100 }];
    const result = evaluatePromotions({ rules, lines, couponCode: "X" });
    expect(result.cart_rule_id).toBe("coup");
    expect(result.cart_discount).toBe(5);
  });

  it("respects usage_limit_total", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "lim",
          name: "lim",
          rule_type: "cart_fixed",
          coupon_code: "ONCE",
          usage_limit_total: 1,
          usage_count: 1,
          config: { amount: 10 },
        }),
      ],
      lines: [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 50 }],
      couponCode: "ONCE",
    });
    expect(result.cart_discount).toBe(0);
  });

  it("filters by sale mode and store", () => {
    const rules = [
      rule({
        id: "wh",
        name: "wh",
        rule_type: "cart_fixed",
        sale_modes: ["wholesale"],
        store_ids: ["s1"],
        config: { amount: 10 },
      }),
    ];
    const lines = [{ line_key: "0", product_id: "p1", category_id: null, quantity: 1, unit_price: 50 }];
    expect(
      evaluatePromotions({ rules, lines, saleMode: "retail", storeId: "s1" }).cart_discount
    ).toBe(0);
    expect(
      evaluatePromotions({ rules, lines, saleMode: "wholesale", storeId: "s2" }).cart_discount
    ).toBe(0);
    expect(
      evaluatePromotions({ rules, lines, saleMode: "wholesale", storeId: "s1" }).cart_discount
    ).toBe(10);
  });

  it("applies category scope", () => {
    const result = evaluatePromotions({
      rules: [
        rule({
          id: "cat",
          name: "cat",
          rule_type: "percent_off_item",
          scope_type: "category",
          scope_ids: ["c9"],
          config: { percent: 50 },
        }),
      ],
      lines: [
        { line_key: "0", product_id: "p1", category_id: "c9", quantity: 1, unit_price: 40 },
        { line_key: "1", product_id: "p2", category_id: "c1", quantity: 1, unit_price: 40 },
      ],
    });
    expect(result.lines[0].discount_amount).toBe(20);
    expect(result.lines[1].discount_amount).toBe(0);
  });
});
