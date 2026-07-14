import { roundMoney } from "@/lib/money";

/**
 * Promotions evaluation mirror (must stay aligned with evaluate_cart_promotions SQL).
 * Source of truth at checkout remains the Postgres RPC; this powers preview + unit tests.
 */

export const PROMOTION_RULE_TYPES = [
  "percent_off_item",
  "fixed_off_item",
  "scheduled_sale_price",
  "cart_percent",
  "cart_fixed",
  "bogo",
  "qty_threshold",
] as const;

export type PromotionRuleType = (typeof PROMOTION_RULE_TYPES)[number];

export const PROMOTION_SCOPE_TYPES = ["all", "product", "category"] as const;
export type PromotionScopeType = (typeof PROMOTION_SCOPE_TYPES)[number];

export type PromotionSaleMode = "retail" | "wholesale";

export interface PromotionRuleConfig {
  percent?: number;
  amount?: number;
  sale_price?: number;
  buy_qty?: number;
  get_qty?: number;
  get_percent?: number;
  min_qty?: number;
}

export interface PromotionRuleInput {
  id: string;
  name: string;
  is_active: boolean;
  rule_type: PromotionRuleType;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  store_ids: string[] | null;
  sale_modes: PromotionSaleMode[];
  coupon_code: string | null;
  stackable_with_cart: boolean;
  min_subtotal: number;
  scope_type: PromotionScopeType;
  scope_ids: string[];
  config: PromotionRuleConfig;
  usage_limit_total: number | null;
  usage_count: number;
}

export interface PromotionCartLineInput {
  line_key: string;
  product_id: string;
  category_id: string | null;
  quantity: number;
  /** Already-resolved list unit price (tiers/variants applied). */
  unit_price: number;
}

export interface PromotionLineResult {
  line_key: string;
  list_unit_price: number;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  promotion_rule_id: string | null;
  line_total: number;
}

export interface PromotionApplication {
  promotion_rule_id: string;
  amount: number;
  level: "item" | "cart";
  line_key: string | null;
  rule_name: string;
}

export interface EvaluatePromotionsResult {
  lines: PromotionLineResult[];
  subtotal: number;
  cart_discount: number;
  cart_rule_id: string | null;
  applications: PromotionApplication[];
}

function normalizeCoupon(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function ruleInWindow(rule: PromotionRuleInput, now: Date): boolean {
  if (rule.starts_at && new Date(rule.starts_at).getTime() > now.getTime()) return false;
  if (rule.ends_at && new Date(rule.ends_at).getTime() < now.getTime()) return false;
  return true;
}

function ruleMatchesStore(rule: PromotionRuleInput, storeId: string | null): boolean {
  if (!rule.store_ids || rule.store_ids.length === 0) return true;
  if (!storeId) return false;
  return rule.store_ids.includes(storeId);
}

function ruleMatchesSaleMode(rule: PromotionRuleInput, saleMode: PromotionSaleMode): boolean {
  if (!rule.sale_modes || rule.sale_modes.length === 0) return true;
  return rule.sale_modes.includes(saleMode);
}

function ruleMatchesScope(rule: PromotionRuleInput, line: PromotionCartLineInput): boolean {
  if (rule.scope_type === "all") return true;
  if (rule.scope_type === "product") return rule.scope_ids.includes(line.product_id);
  if (rule.scope_type === "category") {
    return Boolean(line.category_id && rule.scope_ids.includes(line.category_id));
  }
  return false;
}

function couponGateOk(rule: PromotionRuleInput, couponCode: string | null): boolean {
  const required = normalizeCoupon(rule.coupon_code);
  if (!required) return true;
  return couponCode === required;
}

function usageOk(rule: PromotionRuleInput): boolean {
  if (rule.usage_limit_total == null) return true;
  return rule.usage_count < rule.usage_limit_total;
}

function sortRules(rules: PromotionRuleInput[]): PromotionRuleInput[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

function eligibleRules(
  rules: PromotionRuleInput[],
  opts: {
    storeId: string | null;
    saleMode: PromotionSaleMode;
    now: Date;
    couponCode: string | null;
    requireAuto: boolean;
  }
): PromotionRuleInput[] {
  return sortRules(
    rules.filter((rule) => {
      if (!rule.is_active) return false;
      if (!ruleInWindow(rule, opts.now)) return false;
      if (!ruleMatchesStore(rule, opts.storeId)) return false;
      if (!ruleMatchesSaleMode(rule, opts.saleMode)) return false;
      if (!usageOk(rule)) return false;
      const requiresCoupon = Boolean(normalizeCoupon(rule.coupon_code));
      if (opts.requireAuto && requiresCoupon) return false;
      if (!couponGateOk(rule, opts.couponCode)) return false;
      return true;
    })
  );
}

function lineGross(listUnit: number, qty: number): number {
  return roundMoney(listUnit * qty);
}

function computeBogoDiscount(listUnit: number, qty: number, config: PromotionRuleConfig): number {
  const buyQty = Math.max(1, Number(config.buy_qty ?? 1));
  const getQty = Math.max(1, Number(config.get_qty ?? 1));
  const getPercent = Math.min(100, Math.max(0, Number(config.get_percent ?? 100)));
  const bundle = buyQty + getQty;
  if (qty < bundle) return 0;
  const bundles = Math.floor(qty / bundle);
  const freeUnits = bundles * getQty;
  return roundMoney(freeUnits * listUnit * (getPercent / 100));
}

function computeItemDiscount(
  rule: PromotionRuleInput,
  listUnit: number,
  qty: number
): number {
  const gross = lineGross(listUnit, qty);
  const cfg = rule.config ?? {};

  switch (rule.rule_type) {
    case "percent_off_item": {
      const percent = Math.min(100, Math.max(0, Number(cfg.percent ?? 0)));
      return roundMoney(gross * (percent / 100));
    }
    case "fixed_off_item": {
      const amount = Math.max(0, Number(cfg.amount ?? 0));
      return roundMoney(Math.min(gross, amount * qty));
    }
    case "qty_threshold": {
      const minQty = Math.max(0, Number(cfg.min_qty ?? 0));
      if (qty < minQty) return 0;
      if (cfg.percent != null) {
        const percent = Math.min(100, Math.max(0, Number(cfg.percent)));
        return roundMoney(gross * (percent / 100));
      }
      const amount = Math.max(0, Number(cfg.amount ?? 0));
      return roundMoney(Math.min(gross, amount));
    }
    case "bogo":
      return computeBogoDiscount(listUnit, qty, cfg);
    default:
      return 0;
  }
}

function applyScheduledSale(
  rules: PromotionRuleInput[],
  line: PromotionCartLineInput
): { listUnit: number; ruleId: string | null; ruleName: string | null } {
  let listUnit = line.unit_price;
  let ruleId: string | null = null;
  let ruleName: string | null = null;
  for (const rule of rules) {
    if (rule.rule_type !== "scheduled_sale_price") continue;
    if (!ruleMatchesScope(rule, line)) continue;
    const salePrice = Number(rule.config?.sale_price);
    if (!Number.isFinite(salePrice) || salePrice < 0) continue;
    listUnit = salePrice;
    ruleId = rule.id;
    ruleName = rule.name;
    break; // highest priority already sorted
  }
  return { listUnit, ruleId, ruleName };
}

function bestItemRule(
  rules: PromotionRuleInput[],
  line: PromotionCartLineInput,
  listUnit: number
): { rule: PromotionRuleInput | null; discount: number } {
  let best: PromotionRuleInput | null = null;
  let bestDiscount = 0;
  for (const rule of rules) {
    if (
      rule.rule_type !== "percent_off_item" &&
      rule.rule_type !== "fixed_off_item" &&
      rule.rule_type !== "qty_threshold" &&
      rule.rule_type !== "bogo"
    ) {
      continue;
    }
    if (!ruleMatchesScope(rule, line)) continue;
    const discount = computeItemDiscount(rule, listUnit, line.quantity);
    if (discount <= 0) continue;
    if (
      discount > bestDiscount ||
      (discount === bestDiscount && best && rule.priority > best.priority)
    ) {
      best = rule;
      bestDiscount = discount;
    }
  }
  return { rule: best, discount: bestDiscount };
}

function cartDiscountAmount(rule: PromotionRuleInput, subtotal: number): number {
  if (subtotal < Number(rule.min_subtotal ?? 0)) return 0;
  const cfg = rule.config ?? {};
  if (rule.rule_type === "cart_percent") {
    const percent = Math.min(100, Math.max(0, Number(cfg.percent ?? 0)));
    return roundMoney(subtotal * (percent / 100));
  }
  if (rule.rule_type === "cart_fixed") {
    const amount = Math.max(0, Number(cfg.amount ?? 0));
    return roundMoney(Math.min(subtotal, amount));
  }
  return 0;
}

function pickCartRule(
  autoRules: PromotionRuleInput[],
  couponRules: PromotionRuleInput[],
  subtotal: number,
  couponCode: string | null
): { rule: PromotionRuleInput | null; amount: number } {
  let bestAuto: { rule: PromotionRuleInput; amount: number } | null = null;
  for (const rule of autoRules) {
    if (rule.rule_type !== "cart_percent" && rule.rule_type !== "cart_fixed") continue;
    const amount = cartDiscountAmount(rule, subtotal);
    if (amount <= 0) continue;
    if (!bestAuto || amount > bestAuto.amount) {
      bestAuto = { rule, amount };
    }
  }

  let bestCoupon: { rule: PromotionRuleInput; amount: number } | null = null;
  if (couponCode) {
    for (const rule of couponRules) {
      if (rule.rule_type !== "cart_percent" && rule.rule_type !== "cart_fixed") continue;
      if (!normalizeCoupon(rule.coupon_code)) continue;
      const amount = cartDiscountAmount(rule, subtotal);
      if (amount <= 0) continue;
      if (!bestCoupon || amount > bestCoupon.amount) {
        bestCoupon = { rule, amount };
      }
    }
  }

  if (bestCoupon && bestAuto) {
    // One cart rule: coupon wins unless auto rule is stackable_with_cart — then prefer max.
    if (bestAuto.rule.stackable_with_cart || bestCoupon.rule.stackable_with_cart) {
      return bestCoupon.amount >= bestAuto.amount ? bestCoupon : bestAuto;
    }
    return bestCoupon;
  }
  return bestCoupon ?? bestAuto ?? { rule: null, amount: 0 };
}

export function evaluatePromotions(input: {
  rules: PromotionRuleInput[];
  lines: PromotionCartLineInput[];
  storeId?: string | null;
  saleMode?: PromotionSaleMode;
  couponCode?: string | null;
  now?: Date | string;
}): EvaluatePromotionsResult {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now());
  const storeId = input.storeId ?? null;
  const saleMode = input.saleMode ?? "retail";
  const couponCode = normalizeCoupon(input.couponCode);

  const autoRules = eligibleRules(input.rules, {
    storeId,
    saleMode,
    now,
    couponCode,
    requireAuto: true,
  });
  const couponEligible = eligibleRules(input.rules, {
    storeId,
    saleMode,
    now,
    couponCode,
    requireAuto: false,
  }).filter((r) => Boolean(normalizeCoupon(r.coupon_code)));

  // Item-level: auto + coupon-gated item rules that match the entered coupon
  const itemPool = sortRules([
    ...autoRules,
    ...couponEligible.filter(
      (r) =>
        r.rule_type === "percent_off_item" ||
        r.rule_type === "fixed_off_item" ||
        r.rule_type === "qty_threshold" ||
        r.rule_type === "bogo" ||
        r.rule_type === "scheduled_sale_price"
    ),
  ]);

  const applications: PromotionApplication[] = [];
  const results: PromotionLineResult[] = [];

  for (const line of input.lines) {
    const qty = Number(line.quantity);
    const scheduled = applyScheduledSale(itemPool, line);
    const listUnit = scheduled.listUnit;
    if (scheduled.ruleId && scheduled.listUnit !== line.unit_price) {
      // Scheduled sale changes list price; not stored as discount_amount
    }

    const { rule, discount } = bestItemRule(itemPool, line, listUnit);
    const gross = lineGross(listUnit, qty);
    const discountAmount = roundMoney(Math.min(gross, discount));
    const lineTotal = roundMoney(Math.max(0, gross - discountAmount));
    const unitPrice = qty > 0 ? roundMoney(lineTotal / qty) : 0;

    if (rule && discountAmount > 0) {
      applications.push({
        promotion_rule_id: rule.id,
        amount: discountAmount,
        level: "item",
        line_key: line.line_key,
        rule_name: rule.name,
      });
    }

    results.push({
      line_key: line.line_key,
      list_unit_price: listUnit,
      unit_price: unitPrice,
      quantity: qty,
      discount_amount: discountAmount,
      promotion_rule_id: rule?.id ?? null,
      line_total: lineTotal,
    });
  }

  const subtotal = roundMoney(results.reduce((sum, l) => sum + l.line_total, 0));
  const { rule: cartRule, amount: cartDiscountRaw } = pickCartRule(
    autoRules,
    couponEligible,
    subtotal,
    couponCode
  );
  const cartDiscount = roundMoney(Math.min(subtotal, cartDiscountRaw));

  if (cartRule && cartDiscount > 0) {
    applications.push({
      promotion_rule_id: cartRule.id,
      amount: cartDiscount,
      level: "cart",
      line_key: null,
      rule_name: cartRule.name,
    });
  }

  return {
    lines: results,
    subtotal,
    cart_discount: cartDiscount,
    cart_rule_id: cartRule?.id ?? null,
    applications,
  };
}
