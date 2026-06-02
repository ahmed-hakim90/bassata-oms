import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapUser } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { getUserStoreIds, setUserStoreAccess } from "@/lib/repositories/store.repository";
import type { AppUser } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

export async function getUserByAuthId(authUserId: string): Promise<AppUser | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throwDbError(error, "getUserByAuthId");
  if (!data) return null;
  const storeIds = await getUserStoreIds(data.id);
  return mapUser(data, storeIds);
}

export async function getUser(id: string): Promise<AppUser | null> {
  const db = await getDb();
  const { data, error } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getUser");
  if (!data) return null;
  const storeIds = await getUserStoreIds(data.id);
  return mapUser(data, storeIds);
}

export async function listUsers(): Promise<AppUser[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db.from("users").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listUsers");
  const users: AppUser[] = [];
  for (const row of data ?? []) {
    const storeIds = await getUserStoreIds(row.id);
    users.push(mapUser(row, storeIds));
  }
  return users.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  storeIds: string[];
  authUserId?: string | null;
}): Promise<AppUser> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("users")
    .insert({
      org_id: orgId,
      auth_user_id: input.authUserId ?? null,
      name: input.name,
      email: input.email,
      role: input.role,
      is_active: true,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createUser");
  await setUserStoreAccess(data.id, input.storeIds);
  return mapUser(data, input.storeIds);
}

export async function updateUser(
  id: string,
  input: Partial<{ name: string; email: string; role: UserRole; is_active: boolean; storeIds: string[] }>
): Promise<AppUser | null> {
  const db = await getDb();
  const { storeIds, ...userFields } = input;
  if (Object.keys(userFields).length > 0) {
    const { error } = await db.from("users").update(userFields).eq("id", id);
    if (error) throwDbError(error, "updateUser");
  }
  if (storeIds) await setUserStoreAccess(id, storeIds);
  return getUser(id);
}

export async function upsertPin(userId: string, pinHash: string): Promise<void> {
  const db = await getDb();
  await db.from("pin_codes").delete().eq("user_id", userId);
  const { error } = await db.from("pin_codes").insert({
    user_id: userId,
    pin_hash: pinHash,
    is_active: true,
  });
  if (error) throwDbError(error, "upsertPin");
}

export async function setPin(userId: string, pin: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.rpc("set_user_pin", {
    p_user_id: userId,
    p_pin: pin,
  });
  if (error) throwDbError(error, "setPin");
}

