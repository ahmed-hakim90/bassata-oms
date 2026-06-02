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

  const user = await getCurrentUser();
  const deviceCtx = await getRegisteredDeviceContext();
  const cashierId =
    user && deviceCtx?.storeId === storeId
      ? await getActiveCashierId(storeId, deviceCtx.deviceId, user)
      : null;
  const session = cashierId ? await getActiveSession(storeId, cashierId) : null;
  const store = await storeRepo.getStore(storeId);
  const cashier = cashierId ? await userRepo.getUser(cashierId) : null;
  const device = deviceCtx?.deviceId ? await deviceRepo.getDevice(deviceCtx.deviceId) : null;

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
      Session open — {cashier?.name ?? "Cashier"}
      {cashierId && user && cashierId !== user.id ? (
        <span className="text-muted-foreground"> (switched)</span>
      ) : null}
    </div>
  );
}
