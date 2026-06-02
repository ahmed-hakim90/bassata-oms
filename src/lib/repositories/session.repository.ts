import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapSession } from "@/lib/repositories/mappers";
import type { CashierSession } from "@/lib/types";

export async function listSessions(storeId?: string): Promise<CashierSession[]> {
  const db = await getDb();
  let q = db.from("cashier_sessions").select("*").order("opened_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listSessions");
  return (data ?? []).map(mapSession);
}

export async function listOpenSessions(storeId?: string): Promise<CashierSession[]> {
  const db = await getDb();
  let q = db
    .from("cashier_sessions")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false });
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listOpenSessions");
  return (data ?? []).map(mapSession);
}

export async function getActiveSession(
  storeId: string,
  cashierId?: string | null
): Promise<CashierSession | null> {
  const db = await getDb();
  let q = db
    .from("cashier_sessions")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (cashierId) q = q.eq("cashier_id", cashierId);
  const { data, error } = await q.maybeSingle();
  if (error) throwDbError(error, "getActiveSession");
  return data ? mapSession(data) : null;
}

export async function getSession(id: string): Promise<CashierSession | null> {
  const db = await getDb();
  const { data, error } = await db.from("cashier_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getSession");
  return data ? mapSession(data) : null;
}

export async function openSession(input: {
  storeId: string;
  cashierId: string;
  deviceId: string;
  openingCash: number;
}): Promise<CashierSession> {
  const existing = await getActiveSession(input.storeId, input.cashierId);
  if (existing) return existing;
  const db = await getDb();
  const { data, error } = await db
    .from("cashier_sessions")
    .insert({
      store_id: input.storeId,
      cashier_id: input.cashierId,
      device_id: input.deviceId,
      opening_cash: input.openingCash,
      status: "open",
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "openSession");
  return mapSession(data);
}

export async function closeSession(input: {
  sessionId: string;
  expectedCash: number;
  actualCash: number;
  notes?: string;
  closedBy?: string;
  closeReason?: string;
  forceClosed?: boolean;
}): Promise<CashierSession | null> {
  const db = await getDb();
  const variance = input.actualCash - input.expectedCash;
  const { data, error } = await db
    .from("cashier_sessions")
    .update({
      closed_at: new Date().toISOString(),
      expected_cash: input.expectedCash,
      actual_cash: input.actualCash,
      variance,
      status: "closed",
      notes: input.notes ?? null,
      closed_by: input.closedBy ?? null,
      close_reason: input.closeReason ?? null,
      force_closed: input.forceClosed ?? false,
    })
    .eq("id", input.sessionId)
    .eq("status", "open")
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "closeSession");
  return data ? mapSession(data) : null;
}
