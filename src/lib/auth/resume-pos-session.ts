import { setActiveStoreCookie } from "@/lib/auth/guards";
import {
  getActiveStoreId,
  getRegisteredDeviceContext,
  setActiveCashierId,
} from "@/lib/auth/session";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import type { AppUser, CashierSession } from "@/lib/types";

export async function findOpenSessionForUser(
  user: AppUser
): Promise<{ storeId: string; session: CashierSession } | null> {
  const checks = await Promise.all(
    user.store_ids.map(async (storeId) => {
      const session = await getActiveSession(storeId, user.id);
      return session ? { storeId, session } : null;
    })
  );
  return checks.find((entry): entry is { storeId: string; session: CashierSession } =>
    Boolean(entry)
  ) ?? null;
}

/** Align active store and cashier cookies with the user's open session when resuming POS. */
export async function resumePosSessionForUser(user: AppUser): Promise<string> {
  const device = await getRegisteredDeviceContext();
  const openSession = await findOpenSessionForUser(user);
  const preferredStoreId =
    openSession?.storeId ??
    (device && user.store_ids.includes(device.storeId)
      ? device.storeId
      : user.store_ids[0]!);

  if (device && device.storeId !== preferredStoreId) {
    return preferredStoreId;
  }

  const currentStoreId = await getActiveStoreId();
  if (currentStoreId !== preferredStoreId) {
    await setActiveStoreCookie(preferredStoreId);
  }

  if (openSession && device) {
    await setActiveCashierId(openSession.session.cashier_id, {
      storeId: openSession.storeId,
      deviceId: device.deviceId,
    });
  }

  return preferredStoreId;
}
