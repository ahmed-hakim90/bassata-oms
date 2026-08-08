import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapMonthlyClose } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { MonthlyClose } from "@/lib/types";

type MonthlyCloseInsert = Database["public"]["Tables"]["monthly_closes"]["Insert"];
type MonthlyCloseUpdate = Database["public"]["Tables"]["monthly_closes"]["Update"];

function toClosingInsert(
  input: Omit<MonthlyClose, "id" | "closed_by" | "closed_at">
): MonthlyCloseInsert {
  return {
    org_id: input.org_id,
    store_id: input.store_id,
    period_start: input.period_start,
    period_end: input.period_end,
    status: input.status,
    summary: input.summary as Json,
  };
}

function toClosingUpdate(patch: Partial<MonthlyClose>): MonthlyCloseUpdate {
  return {
    ...(patch.org_id !== undefined ? { org_id: patch.org_id } : {}),
    ...(patch.store_id !== undefined ? { store_id: patch.store_id } : {}),
    ...(patch.period_start !== undefined ? { period_start: patch.period_start } : {}),
    ...(patch.period_end !== undefined ? { period_end: patch.period_end } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.summary !== undefined ? { summary: patch.summary as Json } : {}),
    ...(patch.closed_by !== undefined ? { closed_by: patch.closed_by } : {}),
    ...(patch.closed_at !== undefined ? { closed_at: patch.closed_at } : {}),
  };
}

export async function listClosings(): Promise<MonthlyClose[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("monthly_closes")
    .select("*")
    .eq("org_id", orgId)
    .order("period_end", { ascending: false });
  if (error) throwDbError(error, "listClosings");
  return (data ?? []).map(mapMonthlyClose);
}

export async function getClosing(id: string): Promise<MonthlyClose | null> {
  const db = await getDb();
  const { data, error } = await db.from("monthly_closes").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getClosing");
  return data ? mapMonthlyClose(data) : null;
}

export async function createClosing(
  input: Omit<MonthlyClose, "id" | "closed_by" | "closed_at">
): Promise<MonthlyClose> {
  const db = await getDb();
  const { data, error } = await db
    .from("monthly_closes")
    .insert(toClosingInsert(input))
    .select()
    .single();
  if (error || !data) throwDbError(error, "createClosing");
  return mapMonthlyClose(data);
}

export async function updateClosing(
  id: string,
  patch: Partial<MonthlyClose>
): Promise<MonthlyClose | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("monthly_closes")
    .update(toClosingUpdate(patch))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateClosing");
  return data ? mapMonthlyClose(data) : null;
}

export async function findClosedPeriod(
  storeId: string,
  at: string
): Promise<MonthlyClose | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const date = at.slice(0, 10);
  const { data, error } = await db
    .from("monthly_closes")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "closed")
    .lte("period_start", date)
    .gte("period_end", date)
    .or(`store_id.is.null,store_id.eq.${storeId}`);
  if (error) throwDbError(error, "findClosedPeriod");
  const match = (data ?? []).find(
    (r) => !r.store_id || r.store_id === storeId
  );
  return match ? mapMonthlyClose(match) : null;
}
