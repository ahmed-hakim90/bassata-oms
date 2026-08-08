import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listPlatformAuditLogs } from "@/modules/platform/services/platform-audit.service";
import { PlatformAuditConsole } from "@/modules/platform/components/platform-audit-console";

export default async function PlatformAuditPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const auditLogs = await listPlatformAuditLogs(200);
  return <PlatformAuditConsole auditLogs={auditLogs} />;
}
