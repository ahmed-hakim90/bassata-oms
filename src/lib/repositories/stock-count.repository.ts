import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapStockCount, mapStockCountLine } from "@/lib/repositories/mappers";
import type { StockCount, StockCountLine } from "@/lib/types";

export async function listStockCounts(storeId?: string): Promise<StockCount[]> {
  const db = await getDb();
  let q = db.from("stock_counts").select("*").order("started_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listStockCounts");
  return (data ?? []).map(mapStockCount);
}

export async function getStockCount(id: string): Promise<StockCount | null> {
  const db = await getDb();
  const { data, error } = await db.from("stock_counts").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getStockCount");
  return data ? mapStockCount(data) : null;
}

export async function getStockCountLines(countId: string): Promise<StockCountLine[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("stock_count_lines")
    .select("*")
    .eq("count_id", countId);
  if (error) throwDbError(error, "getStockCountLines");
  return (data ?? []).map(mapStockCountLine);
}

/** Batch-load lines for many counts — avoids N+1 on stock-count list. */
export async function getStockCountLinesForCounts(
  countIds: string[]
): Promise<StockCountLine[]> {
  if (countIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db
    .from("stock_count_lines")
    .select("*")
    .in("count_id", countIds);
  if (error) throwDbError(error, "getStockCountLinesForCounts");
  return (data ?? []).map(mapStockCountLine);
}

export async function createStockCount(
  input: Omit<StockCount, "id" | "started_at" | "completed_at">
): Promise<StockCount> {
  const db = await getDb();
  const { data, error } = await db.from("stock_counts").insert(input).select().single();
  if (error || !data) throwDbError(error, "createStockCount");
  return mapStockCount(data);
}

export async function updateStockCount(
  id: string,
  patch: Partial<StockCount>
): Promise<StockCount | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("stock_counts")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateStockCount");
  return data ? mapStockCount(data) : null;
}

export async function insertStockCountLines(
  lines: Omit<StockCountLine, "id">[]
): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("stock_count_lines").insert(lines);
  if (error) throwDbError(error, "insertStockCountLines");
}
