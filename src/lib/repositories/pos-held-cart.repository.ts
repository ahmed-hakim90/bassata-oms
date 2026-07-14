import { asJson, getDb, throwDbError } from "@/lib/repositories/client";
import { listStores } from "@/lib/repositories/store.repository";
import type { Database, Json } from "@/lib/supabase/database.types";

export type PosHeldCartRow = Database["public"]["Tables"]["pos_held_carts"]["Row"];

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

export async function listHeldCartsForDevice(input: {
  storeId: string;
  deviceId: string;
}): Promise<PosHeldCartRow[]> {
  const storeIds = await orgStoreIds();
  if (!storeIds.includes(input.storeId)) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("pos_held_carts")
    .select("*")
    .eq("store_id", input.storeId)
    .eq("device_id", input.deviceId)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listHeldCartsForDevice");
  return (data ?? []) as PosHeldCartRow[];
}

export async function getHeldCart(id: string): Promise<PosHeldCartRow | null> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return null;

  const db = await getDb();
  const { data, error } = await db
    .from("pos_held_carts")
    .select("*")
    .eq("id", id)
    .in("store_id", storeIds)
    .maybeSingle();
  if (error) throwDbError(error, "getHeldCart");
  return (data as PosHeldCartRow | null) ?? null;
}

export async function insertHeldCart(input: {
  orgId: string;
  storeId: string;
  deviceId: string;
  createdBy: string;
  name: string;
  payload: Record<string, unknown>;
}): Promise<PosHeldCartRow> {
  const db = await getDb();
  const { data, error } = await db
    .from("pos_held_carts")
    .insert({
      org_id: input.orgId,
      store_id: input.storeId,
      device_id: input.deviceId,
      created_by: input.createdBy,
      name: input.name,
      payload: asJson(input.payload),
    })
    .select("*")
    .single();
  if (error || !data) throwDbError(error, "insertHeldCart");
  return data as PosHeldCartRow;
}

export async function deleteHeldCart(id: string): Promise<boolean> {
  const db = await getDb();
  const { data, error } = await db
    .from("pos_held_carts")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throwDbError(error, "deleteHeldCart");
  return Boolean(data);
}

/** One round-trip delete scoped to store+device (no prior get + listStores). */
export async function deleteHeldCartForDevice(input: {
  id: string;
  storeId: string;
  deviceId: string;
}): Promise<boolean> {
  const db = await getDb();
  const { data, error } = await db
    .from("pos_held_carts")
    .delete()
    .eq("id", input.id)
    .eq("store_id", input.storeId)
    .eq("device_id", input.deviceId)
    .select("id")
    .maybeSingle();
  if (error) throwDbError(error, "deleteHeldCartForDevice");
  return Boolean(data);
}

export function payloadAsRecord(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}
