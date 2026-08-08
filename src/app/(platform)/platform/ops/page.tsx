import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import {
  getPlatformEmailStatus,
  listPlatformActiveOnlineOrders,
  listPlatformStockAlerts,
} from "@/modules/platform/services/platform-ops.service";
import { PlatformOpsConsole } from "@/modules/platform/components/platform-ops-console";

export default async function PlatformOpsPage() {
  const admin = await resolvePlatformAdmin();
  if (!admin) return null;

  const [onlineOrders, stockAlerts] = await Promise.all([
    listPlatformActiveOnlineOrders(150),
    listPlatformStockAlerts(100),
  ]);

  return (
    <PlatformOpsConsole
      email={getPlatformEmailStatus()}
      onlineOrders={onlineOrders}
      stockAlerts={stockAlerts}
    />
  );
}
