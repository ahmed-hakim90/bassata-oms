import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listPlatformOpenSessions } from "@/modules/platform/services/platform-ops.service";
import { PlatformSessionsConsole } from "@/modules/platform/components/platform-sessions-console";

export default async function PlatformSessionsPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;
  const sessions = await listPlatformOpenSessions(250);
  return <PlatformSessionsConsole sessions={sessions} />;
}
