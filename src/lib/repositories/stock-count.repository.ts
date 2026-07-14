import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapStockCount, mapStockCountLine } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import type { StockCount, StockCountLine } from "@/lib/types";

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

export async function listStockCounts(storeId?: string): Promise<StockCount[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];
  if (storeId && !storeIds.includes(storeId)) return [];

  const db = await getDb();
  let q = db
    .from("stock_counts")
    .select("*")
    .in("store_id", storeIds)
    .order("started_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listStockCounts");
  return (data ?? []).map(mapStockCount);
}

export async function getStockCount(id: string): Promise<StockCount | null> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return null;

  const db = await getDb();
  const { data, error } = await db
    .from("stock_counts")
    .select("*")
    .eq("id", id)
    .in("store_id", storeIds)
    .maybeSingle();
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

/** True when any stock-count line still references this product (blocks hard delete). */
export async function productHasStockCountLines(productId: string): Promise<boolean> {
  const db = await getDb();
  const { count, error } = await db
    .from("stock_count_lines")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throwDbError(error, "productHasStockCountLines");
  return (count ?? 0) > 0;
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
  if (lines.length === 0) return;
  const db = await getDb();
  const { error } = await db.from("stock_count_lines").insert(lines);
  if (error) throwDbError(error, "insertStockCountLines");
}
