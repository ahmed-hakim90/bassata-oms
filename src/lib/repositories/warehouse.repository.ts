import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapWarehouse } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Warehouse } from "@/lib/types";

export async function listWarehouses(storeId?: string): Promise<Warehouse[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("warehouses")
    .select("*")
    .eq("org_id", orgId)
    .order("store_id")
    .order("is_default", { ascending: false })
    .order("name");
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listWarehouses");
  return (data ?? []).map(mapWarehouse);
}

export async function getWarehouse(id: string): Promise<Warehouse | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("warehouses")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getWarehouse");
  return data ? mapWarehouse(data) : null;
}

export async function getDefaultWarehouse(storeId: string): Promise<Warehouse | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("warehouses")
    .select("*")
    .eq("org_id", orgId)
    .eq("store_id", storeId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throwDbError(error, "getDefaultWarehouse");
  return data ? mapWarehouse(data) : null;
}

export async function createWarehouse(input: {
  storeId: string;
  name: string;
  isDefault?: boolean;
}): Promise<Warehouse> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("warehouses")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      name: input.name,
      is_default: input.isDefault ?? false,
      is_active: true,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createWarehouse");
  if (input.isDefault) await setDefaultWarehouse(input.storeId, data.id);
  return mapWarehouse(data);
}

export async function updateWarehouse(
  id: string,
  input: Partial<Pick<Warehouse, "name" | "is_active">>
): Promise<Warehouse | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("warehouses")
    .update(input)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateWarehouse");
  return data ? mapWarehouse(data) : null;
}

export async function setDefaultWarehouse(storeId: string, warehouseId: string): Promise<void> {
  const { error } = await callRpc<void>("set_default_warehouse", {
    p_store_id: storeId,
    p_warehouse_id: warehouseId,
  });
  if (error) throwDbError(error, "setDefaultWarehouse");
}
