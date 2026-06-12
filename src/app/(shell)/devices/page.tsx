import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { listDevices, listStores } from "@/modules/system/services/users.service";
import { DevicesManager } from "@/modules/devices/components/devices-manager";

export default async function DevicesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/devices");
  const permissions = await getEffectivePermissions(user);
  if (user.role !== "owner" && !permissions.has("settings_manage")) redirect("/");

  const [stores, devices] = await Promise.all([listStores(), listDevices()]);
  return <DevicesManager stores={stores.filter((s) => s.is_active)} devices={devices} />;
}
