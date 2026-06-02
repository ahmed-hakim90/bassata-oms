import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapWaste } from "@/lib/repositories/mappers";
import type { WasteRecord } from "@/lib/types";

export async function listWaste(storeId?: string): Promise<WasteRecord[]> {
  const db = await getDb();
  let q = db.from("waste_records").select("*").order("created_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listWaste");
  return (data ?? []).map(mapWaste);
}

export async function createWaste(
  input: Omit<WasteRecord, "id" | "created_at">
): Promise<WasteRecord> {
  const db = await getDb();
  const { data, error } = await db.from("waste_records").insert(input).select().single();
  if (error || !data) throwDbError(error, "createWaste");
  return mapWaste(data);
}
