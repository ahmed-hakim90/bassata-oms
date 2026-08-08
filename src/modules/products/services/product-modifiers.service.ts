import { requirePermission, requirePermissionOrRole } from "@/lib/auth/guards";
import { supportsProductModifiers } from "@/lib/business-activity-flags";
import { createClient } from "@/lib/supabase/server";
import { getBusinessActivitySettings } from "@/modules/system/services/settings.service";

async function requireModifiersEnabled(): Promise<void> {
  const activity = await getBusinessActivitySettings();
  if (!supportsProductModifiers(activity.activity_type)) {
    throw new Error(
      "إضافات المنتجات للمطاعم والكافيهات والأنشطة اللي فيها تحضير — مش متاحة لنوع النشاط الحالي."
    );
  }
}

export type ProductModifier = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
};

export type ProductModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  modifiers: ProductModifier[];
};

export async function listProductModifierGroups(
  productId: string
): Promise<ProductModifierGroup[]> {
  const user = await requirePermission("product_manage");
  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from("product_modifier_groups")
    .select("id, name, min_select, max_select, sort_order, is_active")
    .eq("org_id", user.org_id)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return [];

  const { data: modifiers, error: modError } = await supabase
    .from("product_modifiers")
    .select("id, group_id, name, price_delta, sort_order, is_active")
    .eq("org_id", user.org_id)
    .in("group_id", groupIds)
    .order("sort_order", { ascending: true });
  if (modError) throw new Error(modError.message);

  const byGroup = new Map<string, ProductModifier[]>();
  for (const row of modifiers ?? []) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      priceDelta: Number(row.price_delta),
      sortOrder: row.sort_order,
      isActive: row.is_active,
    });
    byGroup.set(row.group_id, list);
  }

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    minSelect: g.min_select,
    maxSelect: g.max_select,
    sortOrder: g.sort_order,
    isActive: g.is_active,
    modifiers: byGroup.get(g.id) ?? [],
  }));
}

/** Public POS read — any user with pos_access. */
export async function listActiveModifiersForPos(
  productId: string
): Promise<ProductModifierGroup[]> {
  const user = await requirePermissionOrRole("pos_access", [
    "owner",
    "manager",
    "cashier",
  ]);
  const supabase = await createClient();

  const { data: groups, error } = await supabase
    .from("product_modifier_groups")
    .select("id, name, min_select, max_select, sort_order, is_active")
    .eq("org_id", user.org_id)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const groupIds = (groups ?? []).map((g) => g.id);
  if (groupIds.length === 0) return [];

  const { data: modifiers, error: modError } = await supabase
    .from("product_modifiers")
    .select("id, group_id, name, price_delta, sort_order, is_active")
    .eq("org_id", user.org_id)
    .in("group_id", groupIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (modError) throw new Error(modError.message);

  const byGroup = new Map<string, ProductModifier[]>();
  for (const row of modifiers ?? []) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      priceDelta: Number(row.price_delta),
      sortOrder: row.sort_order,
      isActive: row.is_active,
    });
    byGroup.set(row.group_id, list);
  }

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    minSelect: g.min_select,
    maxSelect: g.max_select,
    sortOrder: g.sort_order,
    isActive: g.is_active,
    modifiers: byGroup.get(g.id) ?? [],
  }));
}

export async function upsertModifierGroup(input: {
  productId: string;
  groupId?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
}): Promise<string> {
  const user = await requirePermission("product_manage");
  await requireModifiersEnabled();
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) throw new Error("اسم المجموعة مطلوب");
  if (input.maxSelect < Math.max(1, input.minSelect)) {
    throw new Error("الحد الأقصى للاختيار يجب أن يكون أكبر من أو يساوي الحد الأدنى");
  }

  if (input.groupId) {
    const { error } = await supabase
      .from("product_modifier_groups")
      .update({
        name,
        min_select: input.minSelect,
        max_select: input.maxSelect,
      })
      .eq("id", input.groupId)
      .eq("org_id", user.org_id);
    if (error) throw new Error(error.message);
    return input.groupId;
  }

  const { data, error } = await supabase
    .from("product_modifier_groups")
    .insert({
      org_id: user.org_id,
      product_id: input.productId,
      name,
      min_select: input.minSelect,
      max_select: input.maxSelect,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "فشل إنشاء المجموعة");
  return data.id;
}

export async function upsertModifier(input: {
  groupId: string;
  modifierId?: string;
  name: string;
  priceDelta: number;
}): Promise<string> {
  const user = await requirePermission("product_manage");
  await requireModifiersEnabled();
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) throw new Error("اسم الإضافة مطلوب");

  if (input.modifierId) {
    const { error } = await supabase
      .from("product_modifiers")
      .update({
        name,
        price_delta: input.priceDelta,
      })
      .eq("id", input.modifierId)
      .eq("org_id", user.org_id);
    if (error) throw new Error(error.message);
    return input.modifierId;
  }

  const { data, error } = await supabase
    .from("product_modifiers")
    .insert({
      org_id: user.org_id,
      group_id: input.groupId,
      name,
      price_delta: input.priceDelta,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "فشل إنشاء الإضافة");
  return data.id;
}

export async function setModifierGroupActive(
  groupId: string,
  isActive: boolean
): Promise<void> {
  const user = await requirePermission("product_manage");
  await requireModifiersEnabled();
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_modifier_groups")
    .update({ is_active: isActive })
    .eq("id", groupId)
    .eq("org_id", user.org_id);
  if (error) throw new Error(error.message);
}
