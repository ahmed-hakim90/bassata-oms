import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapSupplierPayment } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { listStores } from "@/lib/repositories/store.repository";
import { chunkIds } from "@/lib/query-chunks";
import type { PaymentMethod } from "@/lib/types";
import type { SupplierPayment } from "@/lib/types";

export async function insertSupplierPayment(input: {
  storeId: string;
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt: string;
  createdBy: string;
  sessionId?: string | null;
}): Promise<SupplierPayment> {
  const storeIds = (await listStores()).map((store) => store.id);
  if (!storeIds.includes(input.storeId)) {
    throw new Error("Store access denied");
  }

  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      supplier_id: input.supplierId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      reference: input.reference ?? "",
      notes: input.notes ?? "",
      paid_at: input.paidAt,
      created_by: input.createdBy,
      session_id: input.sessionId ?? null,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "insertSupplierPayment");
  return mapSupplierPayment(data);
}

export async function getSupplierPayment(id: string): Promise<SupplierPayment | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getSupplierPayment");
  return data ? mapSupplierPayment(data) : null;
}

export async function listPaymentsForStore(
  storeId: string,
  options?: { supplierId?: string }
): Promise<SupplierPayment[]> {
  const storeIds = (await listStores()).map((store) => store.id);
  if (!storeIds.includes(storeId)) return [];

  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("supplier_payments")
    .select("*")
    .eq("org_id", orgId)
    .eq("store_id", storeId);
  if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);
  const { data, error } = await q.order("paid_at", { ascending: false });
  if (error) throwDbError(error, "listPaymentsForStore");
  return (data ?? []).map(mapSupplierPayment);
}

/** Batch supplier payments across stores — avoids per-store N queries in AP aging. */
export async function listPaymentsForStores(
  storeIds: string[]
): Promise<SupplierPayment[]> {
  const allowed = new Set((await listStores()).map((s) => s.id));
  const scoped = storeIds.filter((id) => allowed.has(id));
  if (scoped.length === 0) return [];

  const db = await getDb();
  const orgId = await getOrgId();
  const rows: SupplierPayment[] = [];

  for (const chunk of chunkIds(scoped)) {
    const { data, error } = await db
      .from("supplier_payments")
      .select("*")
      .eq("org_id", orgId)
      .in("store_id", chunk)
      .order("paid_at", { ascending: false });
    if (error) throwDbError(error, "listPaymentsForStores");
    rows.push(...(data ?? []).map(mapSupplierPayment));
  }

  return rows;
}

export async function listPaymentsForSessions(
  sessionIds: string[]
): Promise<SupplierPayment[]> {
  if (sessionIds.length === 0) return [];
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .select("*")
    .eq("org_id", orgId)
    .in("session_id", sessionIds);
  if (error) throwDbError(error, "listPaymentsForSessions");
  return (data ?? []).map(mapSupplierPayment);
}

export async function voidSupplierPayment(id: string): Promise<SupplierPayment | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("supplier_payments")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .is("voided_at", null)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "voidSupplierPayment");
  return data ? mapSupplierPayment(data) : null;
}
