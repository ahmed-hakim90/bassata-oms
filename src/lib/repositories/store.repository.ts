import { slugifyBranchName } from "@/lib/online-menu-path";
import { asJson, getDb, throwDbError } from "@/lib/repositories/client";
import { mapStore } from "@/lib/repositories/mappers";
import type { Store } from "@/lib/types";
import { getOrgId } from "@/lib/repositories/organization.repository";

export async function listStores(): Promise<Store[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db.from("stores").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listStores");
  return (data ?? []).map(mapStore);
}

export async function getStore(id: string): Promise<Store | null> {
  const db = await getDb();
  const { data, error } = await db.from("stores").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getStore");
  return data ? mapStore(data) : null;
}

export async function createStore(input: {
  name: string;
  code?: string;
  address: string;
  phone?: string;
  timezone?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown>;
}): Promise<Store> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("stores")
    .insert({
      org_id: orgId,
      name: input.name,
      code: input.code ?? "",
      address: input.address,
      phone: input.phone ?? "",
      timezone: input.timezone ?? null,
      is_active: input.is_active ?? true,
      settings: asJson(input.settings ?? {}),
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createStore");
  return mapStore(data);
}

export async function updateStore(
  id: string,
  input: Partial<
    Pick<Store, "name" | "code" | "address" | "phone" | "timezone" | "is_active" | "settings">
  >
): Promise<Store | null> {
  const db = await getDb();
  const { settings, ...rest } = input;
  const row = {
    ...rest,
    ...(settings !== undefined ? { settings: asJson(settings) } : {}),
  };
  const { data, error } = await db
    .from("stores")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateStore");
  return data ? mapStore(data) : null;
}

export async function getUserStoreIds(userId: string): Promise<string[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("user_store_access")
    .select("store_id")
    .eq("user_id", userId);
  if (error) throwDbError(error, "getUserStoreIds");
  return (data ?? []).map((r) => r.store_id);
}

export async function isMenuSlugTaken(
  orgId: string,
  slug: string,
  excludeStoreId?: string
): Promise<boolean> {
  const db = await getDb();
  let query = db
    .from("stores")
    .select("id")
    .eq("org_id", orgId)
    .eq("settings->>online_menu_slug", slug);
  if (excludeStoreId) query = query.neq("id", excludeStoreId);
  const { data, error } = await query.limit(1);
  if (error) throwDbError(error, "isMenuSlugTaken");
  return (data?.length ?? 0) > 0;
}

export async function ensureUniqueMenuSlug(
  orgId: string,
  baseSlug: string,
  excludeStoreId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;
  while (await isMenuSlugTaken(orgId, slug, excludeStoreId)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function allocateMenuSlug(
  orgId: string,
  name: string,
  storeId?: string
): Promise<string> {
  const baseSlug = slugifyBranchName(name, storeId);
  return ensureUniqueMenuSlug(orgId, baseSlug);
}

export async function setUserStoreAccess(userId: string, storeIds: string[]): Promise<void> {
  const db = await getDb();
  await db.from("user_store_access").delete().eq("user_id", userId);
  if (storeIds.length > 0) {
    const { error } = await db
      .from("user_store_access")
      .insert(storeIds.map((store_id) => ({ user_id: userId, store_id })));
    if (error) throwDbError(error, "setUserStoreAccess");
  }
}
