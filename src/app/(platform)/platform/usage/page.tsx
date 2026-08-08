import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { listPlatformUsageMatrix } from "@/modules/platform/services/platform-plan.service";
import { PlatformUsageConsole } from "@/modules/platform/components/platform-usage-console";

export default async function PlatformUsagePage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const rows = await listPlatformUsageMatrix();
  return <PlatformUsageConsole rows={rows} />;
}
