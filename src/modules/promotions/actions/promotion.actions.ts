"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import type { PromotionRuleType, PromotionScopeType } from "@/lib/types";
import {
  createPromotion,
  evaluateCartPromotions,
  listPromotions,
  removePromotion,
  togglePromotion,
  updatePromotion,
} from "@/modules/promotions/services/promotion.service";
import { listCategories } from "@/modules/products/services/product.service";
import { listProducts } from "@/modules/products/services/product.service";

async function requirePromoManage() {
  await requireFeature("promotions");
  return requirePermissionOrRole("manage_promotions", ["owner", "manager"]);
}

export async function getPromotionsPageData() {
  const user = await requirePromoManage();
  const [rules, categories, products] = await Promise.all([
    listPromotions(),
    listCategories(),
    listProducts(),
  ]);
  return {
    rules,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    products: products
      .filter((p) => p.is_active && p.product_type !== "ingredient")
      .map((p) => ({ id: p.id, name: p.name, category_id: p.category_id })),
    userId: user.id,
  };
}

export async function upsertPromotionAction(input: {
  id?: string;
  name: string;
  isActive?: boolean;
  ruleType: PromotionRuleType;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  storeIds?: string[] | null;
  saleModes?: ("retail" | "wholesale")[];
  couponCode?: string | null;
  stackableWithCart?: boolean;
  minSubtotal?: number;
  scopeType?: PromotionScopeType;
  scopeIds?: string[];
  config?: Record<string, number | undefined>;
  usageLimitTotal?: number | null;
}) {
  const user = await requirePromoManage();
  const payload = {
    id: input.id,
    name: input.name,
    is_active: input.isActive,
    rule_type: input.ruleType,
    priority: input.priority,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    store_ids: input.storeIds,
    sale_modes: input.saleModes,
    coupon_code: input.couponCode,
    stackable_with_cart: input.stackableWithCart,
    min_subtotal: input.minSubtotal,
    scope_type: input.scopeType,
    scope_ids: input.scopeIds,
    config: input.config,
    usage_limit_total: input.usageLimitTotal,
  };
  const rule = input.id
    ? await updatePromotion({ ...payload, id: input.id }, user.id)
    : await createPromotion(payload, user.id);
  revalidatePath("/promotions");
  return rule;
}

export async function togglePromotionAction(id: string, isActive: boolean) {
  const user = await requirePromoManage();
  await togglePromotion(id, isActive, user.id);
  revalidatePath("/promotions");
}

export async function deletePromotionAction(id: string) {
  const user = await requirePromoManage();
  await removePromotion(id, user.id);
  revalidatePath("/promotions");
}

export async function previewPromotionsAction(input: {
  lines: {
    line_key: string;
    product_id: string;
    category_id: string | null;
    quantity: number;
    unit_price: number;
  }[];
  storeId?: string | null;
  saleMode?: "retail" | "wholesale";
  couponCode?: string | null;
}) {
  await requireFeature("promotions");
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  return evaluateCartPromotions(input);
}
