import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listCompanyInvites } from "@/modules/platform/services/platform-invite.service";
import { PlatformInvitesConsole } from "@/modules/platform/components/platform-invites-console";

export default async function PlatformInvitesPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const invites = await listCompanyInvites(100);
  return <PlatformInvitesConsole invites={invites} />;
}
