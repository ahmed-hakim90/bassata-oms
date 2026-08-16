import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import * as storeRepo from "@/lib/repositories/store.repository";
import { listDevices } from "@/modules/system/services/users.service";
import { DevicesManager } from "@/modules/devices/components/devices-manager";
import { buildDevicesGlance } from "@/modules/devices/lib/devices-glance";

export default async function DevicesRoute() {
  try {
    await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للأجهزة"
          description="إدارة أجهزة الكاشير للمالك أو المدير فقط."
        />
      );
    }
    throw error;
  }

  const [stores, devices] = await Promise.all([
    storeRepo.listStores(),
    listDevices(),
  ]);
  const storeNames = Object.fromEntries(stores.map((s) => [s.id, s.name]));
  const glance = buildDevicesGlance({ devices, storeNames });

  return <DevicesManager stores={stores} devices={devices} glance={glance} />;
}
