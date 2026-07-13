import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";

export async function writePlatformAuditLog(input: {
  platformAdminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("platform_audit_logs").insert({
    platform_admin_id: input.platformAdminId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) throw new Error(`platform_audit_logs insert failed: ${error.message}`);
}

export type PlatformAuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
  platform_admin_id: string | null;
};

export async function listPlatformAuditLogs(limit = 50): Promise<PlatformAuditLogRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, platform_admin_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`platform_audit_logs list failed: ${error.message}`);
  return data ?? [];
}

export async function auditAs(admin: PlatformAdmin, input: Omit<Parameters<typeof writePlatformAuditLog>[0], "platformAdminId">) {
  return writePlatformAuditLog({ ...input, platformAdminId: admin.id });
}
