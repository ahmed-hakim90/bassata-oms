import * as auditRepo from "@/lib/repositories/audit.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { AuditLog } from "@/lib/types";

export interface WriteAuditLogInput {
  orgId: string;
  storeId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<AuditLog> {
  const id = await auditRepo.insertAuditLog({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    storeId: input.storeId,
    metadata: input.metadata,
  });
  const logs = await auditRepo.listAuditLogs({ limit: 1 });
  const entry = logs.find((l) => l.id === id) ?? {
    id,
    org_id: input.orgId,
    store_id: input.storeId ?? null,
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };
  return entry;
}

export async function getAuditLogs(filters?: {
  orgId?: string;
  storeId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  const repoFilters = {
    storeId: filters?.storeId,
    userId: filters?.userId,
    action: filters?.action,
    from: filters?.from,
    to: filters?.to,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  };
  if (filters?.orgId) {
    return auditRepo.listAuditLogs(repoFilters);
  }
  await getOrgId();
  return auditRepo.listAuditLogs(repoFilters);
}
