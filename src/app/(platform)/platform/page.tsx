import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listOrganizationHealthSummaries } from "@/modules/platform/services/platform-org.service";
import { countPendingCompanyInvites } from "@/modules/platform/services/platform-invite.service";
import { PlatformConsole } from "@/modules/platform/components/platform-console";

export default async function PlatformPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) {
    // Layout already shows AccessDenied; keep page from fetching control-plane data.
    return null;
  }

  const [organizations, pendingInvites] = await Promise.all([
    listOrganizationHealthSummaries(),
    countPendingCompanyInvites(),
  ]);

  return (
    <PlatformConsole
      organizations={organizations}
      pendingInvites={pendingInvites}
    />
  );
}
