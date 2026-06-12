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
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("stores")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
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
  const orgId = await getOrgId();
  const { settings, ...rest } = input;
  const row = {
    ...rest,
    ...(settings !== undefined ? { settings: asJson(settings) } : {}),
  };
  const { data, error } = await db
    .from("stores")
    .update(row)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateStore");
  return data ? mapStore(data) : null;
}

export async function getUserStoreIds(userId: string): Promise<string[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("user_store_access")
    .select("store_id, stores!inner(org_id), users!inner(org_id)")
    .eq("user_id", userId)
    .eq("stores.org_id", orgId)
    .eq("users.org_id", orgId);
  if (error) throwDbError(error, "getUserStoreIds");
  return (data ?? []).map((r) => r.store_id);
}

export async function setUserStoreAccess(userId: string, storeIds: string[]): Promise<void> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data: userRow, error: userError } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (userError) throwDbError(userError, "setUserStoreAccess.userScope");
  if (!userRow) throw new Error("User not found or out of scope");

  const requestedStoreIds = Array.from(new Set(storeIds));
  let allowedStoreIds: Array<{ id: string }> = [];
  if (requestedStoreIds.length > 0) {
    const { data, error } = await db
      .from("stores")
      .select("id")
      .eq("org_id", orgId)
      .in("id", requestedStoreIds);
    if (error) throwDbError(error, "setUserStoreAccess.storeScope");
    allowedStoreIds = data ?? [];
  }
  const scopedStoreIds = allowedStoreIds.map((row) => row.id);
  if (requestedStoreIds.length !== scopedStoreIds.length) {
    throw new Error("One or more stores are out of scope");
  }

  await db.from("user_store_access").delete().eq("user_id", userId);
  if (scopedStoreIds.length > 0) {
    const { error } = await db
      .from("user_store_access")
      .insert(scopedStoreIds.map((store_id) => ({ user_id: userId, store_id })));
    if (error) throwDbError(error, "setUserStoreAccess");
  }
}
