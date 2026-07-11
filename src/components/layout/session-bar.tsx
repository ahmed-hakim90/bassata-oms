import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import {
  getActiveCashierId,
  getActiveStoreId,
  getCurrentUser,
  getRegisteredDeviceContext,
} from "@/lib/auth/session";
import { requireStoreAccess } from "@/lib/auth/guards";

export async function SessionBar() {
  const storeId = await getActiveStoreId();
  if (!storeId) return null;

  try {
    await requireStoreAccess(storeId);
  } catch {
    return null;
  }

  const [user, deviceCtx] = await Promise.all([
    getCurrentUser(),
    getRegisteredDeviceContext(),
  ]);

  const cashierId =
    user && deviceCtx?.storeId === storeId
      ? await getActiveCashierId(storeId, deviceCtx.deviceId, user)
      : null;

  const [session, store, cashier, device] = await Promise.all([
    cashierId ? getActiveSession(storeId, cashierId) : Promise.resolve(null),
    storeRepo.getStore(storeId),
    cashierId ? userRepo.getUser(cashierId) : Promise.resolve(null),
    deviceCtx?.deviceId
      ? deviceRepo.getDevice(deviceCtx.deviceId)
      : Promise.resolve(null),
  ]);

  if (!session) return null;

  return (
    <div className="border-b border-border/60 bg-primary/5 px-4 py-2 text-center text-sm">
      <span className="font-medium">{store?.name}</span>
      {device ? (
        <>
          <span className="mx-2 text-muted-foreground">·</span>
          {device.name}
        </>
      ) : null}
      <span className="mx-2 text-muted-foreground">·</span>
      جلسة مفتوحة - {cashier?.name ?? "الكاشير"}
      {cashierId && user && cashierId !== user.id ? (
        <span className="text-muted-foreground"> (تم التبديل)</span>
      ) : null}
    </div>
  );
}
