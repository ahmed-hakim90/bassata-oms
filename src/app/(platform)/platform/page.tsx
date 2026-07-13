import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import {
  getPlatformRollup,
  listOrganizationHealthSummaries,
} from "@/modules/platform/services/platform-org.service";
import { listCompanyInvites, countPendingCompanyInvites } from "@/modules/platform/services/platform-invite.service";
import { listPlatformAuditLogs } from "@/modules/platform/services/platform-audit.service";
import { PlatformConsole } from "@/modules/platform/components/platform-console";

export default async function PlatformPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) {
    // Layout already shows AccessDenied; keep page from fetching control-plane data.
    return null;
  }

  const [organizations, invites, auditLogs, pendingInvites] = await Promise.all([
    listOrganizationHealthSummaries(),
    listCompanyInvites(40),
    listPlatformAuditLogs(40),
    countPendingCompanyInvites(),
  ]);

  const rollup = getPlatformRollup(organizations, pendingInvites);

  return (
    <PlatformConsole
      organizations={organizations}
      rollup={rollup}
      invites={invites}
      auditLogs={auditLogs}
    />
  );
}
