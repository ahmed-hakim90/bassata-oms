import { asJson, callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapAuditLog } from "@/lib/repositories/mappers";
import type { AuditLog } from "@/lib/types";
import { getOrgId } from "@/lib/repositories/organization.repository";

export async function insertAuditLog(input: {
  action: string;
  entityType: string;
  entityId: string;
  storeId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await callRpc<string>("insert_audit_log", {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_store_id: input.storeId ?? undefined,
    p_metadata: input.metadata ? asJson(input.metadata) : {},
  });
  if (error) throwDbError(error, "insertAuditLog");
  return data as string;
}

export async function listAuditLogs(filters?: {
  storeId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("audit_logs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (filters?.storeId) q = q.eq("store_id", filters.storeId);
  if (filters?.userId) q = q.eq("user_id", filters.userId);
  if (filters?.action) q = q.eq("action", filters.action);
  if (filters?.from) q = q.gte("created_at", filters.from);
  if (filters?.to) q = q.lte("created_at", filters.to);
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);
  const { data, error } = await q;
  if (error) throwDbError(error, "listAuditLogs");
  return (data ?? []).map(mapAuditLog);
}
