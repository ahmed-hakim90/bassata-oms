import { asJson, getDb, throwDbError } from "@/lib/repositories/client";
import { mapAppSetting, mapOrganization } from "@/lib/repositories/mappers";
import type { AppSetting, Organization } from "@/lib/types";

export async function getOrgId(): Promise<string> {
  const db = await getDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await db
    .from("users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) throwDbError(error, "getOrgId");
  return data.org_id;
}

export async function getOrganization(): Promise<Organization> {
  const orgId = await getOrgId();
  const db = await getDb();
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error || !data) throwDbError(error, "getOrganization");
  return mapOrganization(data);
}

export async function updateOrganization(
  updates: Partial<
    Pick<Organization, "name" | "currency" | "timezone" | "settings" | "logo_url" | "country">
  >
): Promise<Organization> {
  const orgId = await getOrgId();
  const db = await getDb();
  const { settings, ...rest } = updates;
  const row = {
    ...rest,
    ...(settings !== undefined ? { settings: asJson(settings) } : {}),
  };
  const { data, error } = await db
    .from("organizations")
    .update(row)
    .eq("id", orgId)
    .select()
    .single();
  if (error || !data) throwDbError(error, "updateOrganization");
  return mapOrganization(data);
}

export async function listSettings(): Promise<AppSetting[]> {
  const orgId = await getOrgId();
  const db = await getDb();
  const { data, error } = await db.from("app_settings").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listSettings");
  return (data ?? []).map(mapAppSetting);
}

export async function countOrganizations(): Promise<number> {
  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  const { count, error } = await admin
    .from("organizations")
    .select("*", { count: "exact", head: true });
  if (error) throwDbError(error, "countOrganizations");
  return count ?? 0;
}

export async function upsertSetting(key: string, value: Record<string, unknown>): Promise<AppSetting> {
  const orgId = await getOrgId();
  const db = await getDb();
  const { data, error } = await db
    .from("app_settings")
    .upsert({ org_id: orgId, key, value: asJson(value) }, { onConflict: "org_id,key" })
    .select()
    .single();
  if (error || !data) throwDbError(error, "upsertSetting");
  return mapAppSetting(data);
}
