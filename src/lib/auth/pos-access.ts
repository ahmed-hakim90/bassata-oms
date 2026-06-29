import { requireAuth, requirePermissionOrRole, requireStoreAccess } from "@/lib/auth/guards";
import {
  getActiveCashierId,
  getActiveStoreId,
  getRegisteredDeviceContext,
  setActiveCashierId,
} from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import type { AppUser } from "@/lib/types";
export class PosAccessError extends Error {
  constructor(
    message: string,
    public code:
      | "login_required"
      | "no_device"
      | "device_inactive"
      | "store_mismatch"
      | "store_required"
      | "access_denied"
      | "cashier_required"
      | "role_denied"
  ) {
    super(message);
    this.name = "PosAccessError";
  }
}

export interface PosAccessContext {
  user: AppUser;
  storeId: string;
  deviceId: string;
  activeCashierId: string;
}

export async function resolvePosAccess(
  options: { requireCashierRole?: boolean; clearInvalidCashier?: boolean } = {}
): Promise<PosAccessContext> {
  let user: AppUser;
  try {
    user = await requireAuth();
  } catch {
    throw new PosAccessError("Sign in required", "login_required");
  }

  try {
    await requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
  } catch {
    throw new PosAccessError("POS not available for this role", "role_denied");
  }

  if (options.requireCashierRole && user.role !== "cashier") {
    throw new PosAccessError("Cashier account required", "role_denied");
  }

  const storeId = await getActiveStoreId();
  if (!storeId) {
    throw new PosAccessError("Select a store to continue", "store_required");
  }

  try {
    await requireStoreAccess(storeId);
  } catch {
    throw new PosAccessError("Store access denied", "access_denied");
  }

  const deviceCtx = await getRegisteredDeviceContext();
  if (!deviceCtx) {
    throw new PosAccessError("Register this device to continue", "no_device");
  }

  if (deviceCtx.storeId !== storeId) {
    throw new PosAccessError("Device belongs to another store", "store_mismatch");
  }

  const device = await deviceRepo.getDevice(deviceCtx.deviceId);
  if (!device || !device.is_active) {
    throw new PosAccessError("Device is inactive or missing", "device_inactive");
  }

  if (device.store_id !== storeId) {
    throw new PosAccessError("Device belongs to another store", "store_mismatch");
  }

  if (user.role === "cashier") {
    const allowed = await deviceRepo.cashierCanUseDevice(user.id, storeId, device.id);
    if (!allowed) {
      throw new PosAccessError("You are not allowed on this device", "access_denied");
    }
  }

  await deviceRepo.touchDeviceSeen(device.id);

  let activeCashierId = await getActiveCashierId(storeId, device.id, user);
  if (!activeCashierId && user.role === "cashier") {
    const allowed = await deviceRepo.cashierCanUseDevice(user.id, storeId, device.id);
    if (!allowed) {
      throw new PosAccessError("You are not allowed on this device", "access_denied");
    }
    await setActiveCashierId(user.id, { storeId, deviceId: device.id });
    activeCashierId = user.id;
  }
  if (!activeCashierId) {
    throw new PosAccessError("Cashier PIN required", "cashier_required");
  }

  if (user.role === "cashier" && activeCashierId !== user.id) {
    const targetAllowed = await deviceRepo.cashierCanUseDevice(
      activeCashierId,
      storeId,
      device.id
    );
    if (!targetAllowed) {
      if (options.clearInvalidCashier) {
        await setActiveCashierId(null);
      }
      throw new PosAccessError("Switched cashier not allowed on this device", "access_denied");
    }
  }

  return {
    user,
    storeId,
    deviceId: device.id,
    activeCashierId,
  };
}

export async function requirePosAccess(
  options: { requireCashierRole?: boolean } = {}
): Promise<PosAccessContext> {
  const ctx = await resolvePosAccess({ ...options, clearInvalidCashier: true });
  return ctx;
}

export async function getPosAccessOrNull(): Promise<PosAccessContext | null> {
  try {
    return await resolvePosAccess({ clearInvalidCashier: true });
  } catch (e) {
    if (e instanceof PosAccessError) return null;
    throw e;
  }
}

export async function requireCashierOwnSession(
  ctx: PosAccessContext,
  sessionCashierId: string
): Promise<void> {
  if (sessionCashierId !== ctx.activeCashierId) {
    throw new PosAccessError("You can only manage the active cashier session", "access_denied");
  }
  if (ctx.user.role === "cashier" && ctx.activeCashierId !== ctx.user.id) {
    throw new PosAccessError("You can only manage your own session", "access_denied");
  }
}

export async function getActiveSessionForPos(ctx: PosAccessContext) {
  return getActiveSession(ctx.storeId, ctx.activeCashierId);
}
