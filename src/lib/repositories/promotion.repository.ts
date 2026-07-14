import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { PromotionRule, PromotionRuleType, PromotionScopeType } from "@/lib/types";

/** Loose table accessor until database.types is regenerated for promotions. */
function fromTable(db: Awaited<ReturnType<typeof getDb>>, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).from(table);
}

type PromotionRuleRow = {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  rule_type: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  store_ids: string[] | null;
  sale_modes: string[] | null;
  coupon_code: string | null;
  stackable_with_cart: boolean;
  min_subtotal: number;
  scope_type: string;
  scope_ids: string[] | null;
  config: Record<string, unknown> | null;
  usage_limit_total: number | null;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapRule(row: PromotionRuleRow): PromotionRule {
  const config: Record<string, number | undefined> = {};
  const raw = row.config ?? {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number") config[k] = v;
    else if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) {
      config[k] = Number(v);
    }
  }
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    is_active: row.is_active,
    rule_type: row.rule_type as PromotionRuleType,
    priority: row.priority,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    store_ids: row.store_ids,
    sale_modes: (row.sale_modes ?? ["retail", "wholesale"]).filter(
      (m): m is "retail" | "wholesale" => m === "retail" || m === "wholesale"
    ),
    coupon_code: row.coupon_code,
    stackable_with_cart: row.stackable_with_cart,
    min_subtotal: Number(row.min_subtotal ?? 0),
    scope_type: row.scope_type as PromotionScopeType,
    scope_ids: row.scope_ids ?? [],
    config,
    usage_limit_total: row.usage_limit_total,
    usage_count: row.usage_count,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPromotionRules(): Promise<PromotionRule[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await fromTable(db, "promotion_rules")
    .select("*")
    .eq("org_id", orgId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listPromotionRules");
  return ((data ?? []) as PromotionRuleRow[]).map(mapRule);
}

export async function listActivePromotionRulesForEval(orgId?: string): Promise<PromotionRule[]> {
  const db = await getDb();
  const oid = orgId ?? (await getOrgId());
  const { data, error } = await fromTable(db, "promotion_rules")
    .select("*")
    .eq("org_id", oid)
    .eq("is_active", true);
  if (error) throwDbError(error, "listActivePromotionRulesForEval");
  return ((data ?? []) as PromotionRuleRow[]).map(mapRule);
}

export async function getPromotionRule(id: string): Promise<PromotionRule | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await fromTable(db, "promotion_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throwDbError(error, "getPromotionRule");
  return data ? mapRule(data as PromotionRuleRow) : null;
}

export type UpsertPromotionRuleInput = {
  id?: string;
  name: string;
  is_active?: boolean;
  rule_type: PromotionRuleType;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  store_ids?: string[] | null;
  sale_modes?: ("retail" | "wholesale")[];
  coupon_code?: string | null;
  stackable_with_cart?: boolean;
  min_subtotal?: number;
  scope_type?: PromotionScopeType;
  scope_ids?: string[];
  config?: Record<string, number | undefined>;
  usage_limit_total?: number | null;
  created_by?: string | null;
};

export async function upsertPromotionRule(input: UpsertPromotionRuleInput): Promise<PromotionRule> {
  const db = await getDb();
  const orgId = await getOrgId();
  const payload = {
    org_id: orgId,
    name: input.name.trim(),
    is_active: input.is_active ?? true,
    rule_type: input.rule_type,
    priority: input.priority ?? 0,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    store_ids: input.store_ids?.length ? input.store_ids : null,
    sale_modes: input.sale_modes?.length ? input.sale_modes : ["retail", "wholesale"],
    coupon_code: input.coupon_code?.trim() ? input.coupon_code.trim().toUpperCase() : null,
    stackable_with_cart: input.stackable_with_cart ?? false,
    min_subtotal: input.min_subtotal ?? 0,
    scope_type: input.scope_type ?? "all",
    scope_ids: input.scope_ids ?? [],
    config: input.config ?? {},
    usage_limit_total: input.usage_limit_total ?? null,
    updated_at: new Date().toISOString(),
    ...(input.id ? {} : { created_by: input.created_by ?? null }),
  };

  if (input.id) {
    const { data, error } = await fromTable(db, "promotion_rules")
      .update(payload)
      .eq("id", input.id)
      .eq("org_id", orgId)
      .select("*")
      .single();
    if (error) throwDbError(error, "upsertPromotionRule");
    return mapRule(data as PromotionRuleRow);
  }

  const { data, error } = await fromTable(db, "promotion_rules")
    .insert(payload)
    .select("*")
    .single();
  if (error) throwDbError(error, "upsertPromotionRule");
  return mapRule(data as PromotionRuleRow);
}

export async function setPromotionRuleActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { error } = await fromTable(db, "promotion_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throwDbError(error, "setPromotionRuleActive");
}

export async function deletePromotionRule(id: string): Promise<void> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { error } = await fromTable(db, "promotion_rules").delete().eq("id", id).eq("org_id", orgId);
  if (error) throwDbError(error, "deletePromotionRule");
}

export async function listOrderPromotionApplications(orderId: string) {
  const db = await getDb();
  const { data, error } = await fromTable(db, "order_promotion_applications")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throwDbError(error, "listOrderPromotionApplications");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    order_id: row.order_id as string,
    promotion_rule_id: (row.promotion_rule_id as string | null) ?? null,
    order_item_id: (row.order_item_id as string | null) ?? null,
    level: row.level as "item" | "cart",
    amount: Number(row.amount),
    rule_name: (row.rule_name as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}
