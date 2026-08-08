import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listPlatformOrgOptions } from "@/modules/platform/services/platform-users.service";
import { PlatformMarketingConsole } from "@/modules/platform/components/platform-marketing-console";

export default async function PlatformMarketingPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;
  const orgs = await listPlatformOrgOptions();
  return <PlatformMarketingConsole orgs={orgs} />;
}
