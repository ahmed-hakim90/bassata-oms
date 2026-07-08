import { setActiveStoreCookie } from "@/lib/auth/guards";
import { resumePosSessionForUser } from "@/lib/auth/resume-pos-session";
import {
  getActiveStoreId,
  getRegisteredDeviceContext,
  setActiveCashierId,
  setRegisteredDeviceCookie,
} from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import type { AppUser } from "@/lib/types";

/** Pick store/device automatically for small single-branch POS setups. */
export async function preparePosEnvironment(user: AppUser): Promise<void> {
  await resumePosSessionForUser(user);

  const allStores = await storeRepo.listStores();
  const accessibleStores =
    user.role === "owner" || user.role === "manager"
      ? allStores
      : allStores.filter((store) => user.store_ids.includes(store.id));

  let storeId = await getActiveStoreId();
  if (!storeId && accessibleStores.length === 1) {
    storeId = accessibleStores[0]!.id;
    await setActiveStoreCookie(storeId);
  }
  if (!storeId) return;

  const deviceCtx = await getRegisteredDeviceContext();
  if (deviceCtx) return;

  const activeDevices = (await deviceRepo.listDevices(storeId)).filter(
    (device) => device.is_active
  );
  if (activeDevices.length !== 1) return;

  const device = activeDevices[0]!;
  await setRegisteredDeviceCookie({ deviceId: device.id, storeId });
  if (user.role === "cashier") {
    const allowed = await deviceRepo.cashierCanUseDevice(user.id, storeId, device.id);
    if (allowed) {
      await setActiveCashierId(user.id, { storeId, deviceId: device.id });
    }
  }
}
