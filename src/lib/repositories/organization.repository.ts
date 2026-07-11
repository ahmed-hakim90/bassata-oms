import { cache } from "react";
import { asJson, getDb, throwDbError } from "@/lib/repositories/client";
import { mapAppSetting, mapOrganization } from "@/lib/repositories/mappers";
import { getAuthUserId } from "@/lib/auth/auth-user";
import type { AppSetting, Organization } from "@/lib/types";

export const getOrgId = cache(async (): Promise<string> => {
  const authUserId = await getAuthUserId();
  if (!authUserId) throw new Error("Not authenticated");
  const db = await getDb();
  const { data, error } = await db
    .from("users")
    .select("org_id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !data) throwDbError(error, "getOrgId");
  return data.org_id;
});

export const getOrganization = cache(async (): Promise<Organization> => {
  const orgId = await getOrgId();
  const db = await getDb();
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error || !data) throwDbError(error, "getOrganization");
  return mapOrganization(data);
});

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

export const listSettings = cache(async (): Promise<AppSetting[]> => {
  const orgId = await getOrgId();
  const db = await getDb();
  const { data, error } = await db.from("app_settings").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listSettings");
  return (data ?? []).map(mapAppSetting);
});

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
