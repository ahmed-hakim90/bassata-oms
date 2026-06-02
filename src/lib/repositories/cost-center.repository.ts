import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { mapCostCenter } from "@/lib/repositories/mappers";
import type { CostCenter, CostCenterType } from "@/lib/types";

export async function listCostCenters(storeId?: string): Promise<CostCenter[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("cost_centers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (storeId) {
    q = q.or(`store_id.is.null,store_id.eq.${storeId}`);
  }
  const { data, error } = await q;
  if (error) throwDbError(error, "listCostCenters");
  return (data ?? []).map(mapCostCenter);
}

export async function getCostCenter(id: string): Promise<CostCenter | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("cost_centers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDbError(error, "getCostCenter");
  return data ? mapCostCenter(data) : null;
}

export async function createCostCenter(input: {
  name: string;
  code: string;
  type: CostCenterType;
  store_id?: string | null;
}): Promise<CostCenter> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("cost_centers")
    .insert({
      org_id: orgId,
      name: input.name,
      code: input.code,
      type: input.type,
      store_id: input.store_id ?? null,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createCostCenter");
  return mapCostCenter(data);
}

export async function updateCostCenter(
  id: string,
  patch: Partial<Pick<CostCenter, "name" | "code" | "type" | "is_active" | "store_id">>
): Promise<CostCenter | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("cost_centers")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateCostCenter");
  return data ? mapCostCenter(data) : null;
}
