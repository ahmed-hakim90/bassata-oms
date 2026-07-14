import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import * as promoRepo from "@/lib/repositories/promotion.repository";
import {
  evaluatePromotions,
  type EvaluatePromotionsResult,
  type PromotionCartLineInput,
  type PromotionRuleInput,
} from "@/modules/promotions/lib/evaluate-promotions";
import type { PromotionRule, PromotionRuleType, PromotionScopeType } from "@/lib/types";
import type { SalesMode } from "@/lib/constants";

function toEvalRule(rule: PromotionRule): PromotionRuleInput {
  return {
    id: rule.id,
    name: rule.name,
    is_active: rule.is_active,
    rule_type: rule.rule_type,
    priority: rule.priority,
    starts_at: rule.starts_at,
    ends_at: rule.ends_at,
    store_ids: rule.store_ids,
    sale_modes: rule.sale_modes,
    coupon_code: rule.coupon_code,
    stackable_with_cart: rule.stackable_with_cart,
    min_subtotal: rule.min_subtotal,
    scope_type: rule.scope_type,
    scope_ids: rule.scope_ids,
    config: rule.config,
    usage_limit_total: rule.usage_limit_total,
    usage_count: rule.usage_count,
  };
}

export async function listPromotions(): Promise<PromotionRule[]> {
  return promoRepo.listPromotionRules();
}

export async function evaluateCartPromotions(input: {
  lines: PromotionCartLineInput[];
  storeId?: string | null;
  saleMode?: SalesMode;
  couponCode?: string | null;
  orgId?: string;
  /** When provided (e.g. public/admin path), skip authenticated repo load. */
  rules?: PromotionRuleInput[];
}): Promise<EvaluatePromotionsResult> {
  const rules =
    input.rules ??
    (await promoRepo.listActivePromotionRulesForEval(input.orgId)).map(toEvalRule);
  return evaluatePromotions({
    rules,
    lines: input.lines,
    storeId: input.storeId,
    saleMode: input.saleMode ?? "retail",
    couponCode: input.couponCode,
  });
}

/**
 * Load active promotion rules via service-role client (public online menu path).
 * Returns [] when promotions feature flag is off.
 */
export async function loadActivePromotionRulesViaAdmin(
  orgId: string,
  admin: { from: (table: string) => unknown },
  promotionsEnabled: boolean
): Promise<PromotionRuleInput[]> {
  if (!promotionsEnabled) return [];
  const { data, error } = await (
    admin as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: unknown
          ) => {
            eq: (
              col: string,
              val: unknown
            ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .from("promotion_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    toEvalRule({
      id: row.id as string,
      org_id: orgId,
      name: row.name as string,
      is_active: Boolean(row.is_active),
      rule_type: row.rule_type as PromotionRule["rule_type"],
      priority: Number(row.priority ?? 0),
      starts_at: (row.starts_at as string | null) ?? null,
      ends_at: (row.ends_at as string | null) ?? null,
      store_ids: (row.store_ids as string[] | null) ?? null,
      sale_modes: ((row.sale_modes as string[] | null) ?? ["retail", "wholesale"]).filter(
        (m): m is "retail" | "wholesale" => m === "retail" || m === "wholesale"
      ),
      coupon_code: (row.coupon_code as string | null) ?? null,
      stackable_with_cart: Boolean(row.stackable_with_cart),
      min_subtotal: Number(row.min_subtotal ?? 0),
      scope_type: (row.scope_type as PromotionRule["scope_type"]) ?? "all",
      scope_ids: (row.scope_ids as string[] | null) ?? [],
      config: (row.config as Record<string, number | undefined>) ?? {},
      usage_limit_total: (row.usage_limit_total as number | null) ?? null,
      usage_count: Number(row.usage_count ?? 0),
      created_by: null,
      created_at: "",
      updated_at: "",
    })
  );
}

export async function createPromotion(
  input: promoRepo.UpsertPromotionRuleInput,
  userId: string
): Promise<PromotionRule> {
  validatePromotionInput(input);
  const orgId = await getOrgId();
  const rule = await promoRepo.upsertPromotionRule({ ...input, created_by: userId });
  await writeAuditLog({
    orgId,
    userId,
    action: "promotion.created",
    entityType: "promotion_rule",
    entityId: rule.id,
    metadata: { name: rule.name, rule_type: rule.rule_type },
  });
  return rule;
}

export async function updatePromotion(
  input: promoRepo.UpsertPromotionRuleInput & { id: string },
  userId: string
): Promise<PromotionRule> {
  validatePromotionInput(input);
  const orgId = await getOrgId();
  const existing = await promoRepo.getPromotionRule(input.id);
  if (!existing) throw new Error("العرض غير موجود");
  const rule = await promoRepo.upsertPromotionRule(input);
  await writeAuditLog({
    orgId,
    userId,
    action: "promotion.updated",
    entityType: "promotion_rule",
    entityId: rule.id,
    metadata: { name: rule.name, rule_type: rule.rule_type },
  });
  return rule;
}

export async function togglePromotion(
  id: string,
  isActive: boolean,
  userId: string
): Promise<void> {
  const orgId = await getOrgId();
  await promoRepo.setPromotionRuleActive(id, isActive);
  await writeAuditLog({
    orgId,
    userId,
    action: "promotion.toggled",
    entityType: "promotion_rule",
    entityId: id,
    metadata: { is_active: isActive },
  });
}

export async function removePromotion(id: string, userId: string): Promise<void> {
  const orgId = await getOrgId();
  await promoRepo.deletePromotionRule(id);
  await writeAuditLog({
    orgId,
    userId,
    action: "promotion.deleted",
    entityType: "promotion_rule",
    entityId: id,
    metadata: {},
  });
}

function validatePromotionInput(input: promoRepo.UpsertPromotionRuleInput) {
  if (!input.name?.trim()) throw new Error("اسم العرض مطلوب");
  const type = input.rule_type;
  const cfg = input.config ?? {};

  if (type === "percent_off_item" || type === "cart_percent") {
    const pct = Number(cfg.percent ?? NaN);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error("نسبة الخصم لازم تكون بين 1 و 100");
    }
  }
  if (type === "fixed_off_item" || type === "cart_fixed") {
    const amt = Number(cfg.amount ?? NaN);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("مبلغ الخصم غير صالح");
  }
  if (type === "scheduled_sale_price") {
    const price = Number(cfg.sale_price ?? NaN);
    if (!Number.isFinite(price) || price < 0) throw new Error("سعر العرض غير صالح");
    if (!input.starts_at || !input.ends_at) {
      throw new Error("سعر العرض المجدول يحتاج تاريخ بداية ونهاية");
    }
  }
  if (type === "bogo") {
    if (!(Number(cfg.buy_qty) > 0) || !(Number(cfg.get_qty) > 0)) {
      throw new Error("اشتري واحصل يحتاج كميات صحيحة");
    }
  }
  if (type === "qty_threshold") {
    if (!(Number(cfg.min_qty) > 0)) throw new Error("حد الكمية غير صالح");
    if (cfg.percent == null && cfg.amount == null) {
      throw new Error("حدد نسبة أو مبلغ لخصم الكمية");
    }
  }
  if (input.scope_type === "product" || input.scope_type === "category") {
    if (!input.scope_ids?.length) throw new Error("اختر منتجات أو فئات للعرض");
  }
}

export type { PromotionRuleType, PromotionScopeType };
