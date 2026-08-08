import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapGlAccount } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { GlAccount, GlAccountType } from "@/lib/types";

export async function listGlAccounts(options?: {
  activeOnly?: boolean;
  postableOnly?: boolean;
}): Promise<GlAccount[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("gl_accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });
  if (options?.activeOnly) q = q.eq("is_active", true);
  if (options?.postableOnly) q = q.eq("is_postable", true);
  const { data, error } = await q;
  if (error) throwDbError(error, "listGlAccounts");
  return (data ?? []).map(mapGlAccount);
}

export async function getGlAccount(id: string): Promise<GlAccount | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("gl_accounts")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getGlAccount");
  return data ? mapGlAccount(data) : null;
}

export async function getGlAccountBySystemKey(
  systemKey: string
): Promise<GlAccount | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("gl_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("system_key", systemKey)
    .maybeSingle();
  if (error) throwDbError(error, "getGlAccountBySystemKey");
  return data ? mapGlAccount(data) : null;
}

export async function countGlAccounts(): Promise<number> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { count, error } = await db
    .from("gl_accounts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throwDbError(error, "countGlAccounts");
  return count ?? 0;
}

export async function seedDefaultChartOfAccounts(orgId: string): Promise<void> {
  const { error } = await callRpc("seed_default_chart_of_accounts", {
    p_org_id: orgId,
  });
  if (error) throwDbError(error, "seedDefaultChartOfAccounts");
}

export async function createGlAccount(input: {
  parent_id?: string | null;
  code: string;
  name: string;
  account_type: GlAccountType;
  is_postable?: boolean;
  sort_order?: number;
}): Promise<GlAccount> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("gl_accounts")
    .insert({
      org_id: orgId,
      parent_id: input.parent_id ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      account_type: input.account_type,
      is_postable: input.is_postable ?? true,
      is_system: false,
      system_key: null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createGlAccount");
  return mapGlAccount(data);
}

export async function updateGlAccount(
  id: string,
  patch: Partial<
    Pick<
      GlAccount,
      "parent_id" | "code" | "name" | "account_type" | "is_postable" | "is_active" | "sort_order"
    >
  >
): Promise<GlAccount | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const payload: Partial<
    Pick<
      GlAccount,
      "parent_id" | "code" | "name" | "account_type" | "is_postable" | "is_active" | "sort_order"
    >
  > & { updated_at: string } = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.code !== undefined) payload.code = patch.code.trim();
  if (patch.name !== undefined) payload.name = patch.name.trim();

  const { data, error } = await db
    .from("gl_accounts")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateGlAccount");
  return data ? mapGlAccount(data) : null;
}
