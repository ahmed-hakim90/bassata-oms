import * as auditRepo from "@/lib/repositories/audit.repository";
import {
  GL_POSTING_FAILED_ACTION,
  type GlPostingFailure,
} from "@/modules/accounting/lib/gl-posting-failure-labels";

export type { GlPostingFailure };

export async function listRecentGlPostingFailures(limit = 8): Promise<{
  failures: GlPostingFailure[];
  count: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const logs = await auditRepo.listAuditLogs({
    action: GL_POSTING_FAILED_ACTION,
    from: since.toISOString(),
    limit: Math.min(Math.max(limit, 1), 50),
  });

  const failures = logs.map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      id: log.id,
      createdAt: log.created_at,
      entityId: log.entity_id,
      storeId: log.store_id,
      label: typeof meta.label === "string" ? meta.label : "gl_posting",
      source: typeof meta.source === "string" ? meta.source : "",
      error:
        typeof meta.error === "string"
          ? meta.error
          : "فشل ترحيل القيد الأوتوماتيك",
    };
  });

  return { failures, count: failures.length };
}
