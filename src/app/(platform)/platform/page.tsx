import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listOrganizationsForPlatform } from "@/modules/platform/services/platform-org.service";
import { listCompanyInvites } from "@/modules/platform/services/platform-invite.service";
import { listPlatformAuditLogs } from "@/modules/platform/services/platform-audit.service";
import { PlatformConsole } from "@/modules/platform/components/platform-console";

export default async function PlatformPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) {
    // Layout already shows AccessDenied; keep page from fetching control-plane data.
    return null;
  }

  const [organizations, invites, auditLogs] = await Promise.all([
    listOrganizationsForPlatform(),
    listCompanyInvites(40),
    listPlatformAuditLogs(40),
  ]);

  return (
    <PlatformConsole
      organizations={organizations}
      invites={invites}
      auditLogs={auditLogs}
    />
  );
}
