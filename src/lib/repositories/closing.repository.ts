import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapMonthlyClose } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Json } from "@/lib/supabase/database.types";
import type { MonthlyClose } from "@/lib/types";

function toClosingRow(
  input: Partial<MonthlyClose>
): Partial<{
  org_id: string;
  store_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  summary: Json;
  closed_by: string | null;
  closed_at: string | null;
}> {
  const { summary, ...rest } = input;
  return {
    ...rest,
    ...(summary !== undefined ? { summary: summary as Json } : {}),
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
    .insert(toClosingRow(input))
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
    .update(toClosingRow(patch))
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
