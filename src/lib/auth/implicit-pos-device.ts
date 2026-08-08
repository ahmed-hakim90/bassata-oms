import { setActiveStoreCookie } from "@/lib/auth/guards";
import { IMPLICIT_POS_DEVICE_BINDING } from "@/lib/auth/implicit-pos-device-policy";
import { resumePosSessionForUser } from "@/lib/auth/resume-pos-session";
import {
  clearRegisteredDeviceCookie,
  getActiveStoreId,
  getRegisteredDeviceContext,
  setActiveCashierId,
  setRegisteredDeviceCookie,
} from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import type { AppUser } from "@/lib/types";

export { IMPLICIT_POS_DEVICE_BINDING };

const DEFAULT_DEVICE_NAME = "كاشير رئيسي";

export type ImplicitPosDeviceResult =
  | { ok: true; storeId: string; deviceId: string; createdDevice: boolean }
  | { ok: false; reason: "store_required" | "access_denied" | "no_device" };

function accessibleStoresFor(user: AppUser, stores: Awaited<ReturnType<typeof storeRepo.listStores>>) {
  if (user.role === "owner" || user.role === "manager") return stores;
  return stores.filter((store) => user.store_ids.includes(store.id));
}

async function resolveStoreId(
  user: AppUser,
  preferredStoreId?: string | null
): Promise<string | null> {
  const allStores = await storeRepo.listStores();
  const accessible = accessibleStoresFor(user, allStores);
  if (preferredStoreId && accessible.some((store) => store.id === preferredStoreId)) {
    return preferredStoreId;
  }

  let storeId = await getActiveStoreId();
  if (storeId && accessible.some((store) => store.id === storeId)) {
    return storeId;
  }

  if (accessible.length === 1) {
    storeId = accessible[0]!.id;
    await setActiveStoreCookie(storeId);
    return storeId;
  }

  return null;
}

async function pickOrCreateDevice(
  user: AppUser,
  storeId: string
): Promise<{ device: deviceRepo.Device; created: boolean } | null> {
  const activeDevices = (await deviceRepo.listDevices(storeId)).filter((device) => device.is_active);
  const preferred =
    activeDevices.find((device) => device.name === DEFAULT_DEVICE_NAME) ?? activeDevices[0] ?? null;

  if (preferred) {
    if (user.role === "cashier") {
      const allowed = await deviceRepo.cashierCanUseDevice(user.id, storeId, preferred.id);
      if (allowed) return { device: preferred, created: false };

      for (const device of activeDevices) {
        if (device.id === preferred.id) continue;
        if (await deviceRepo.cashierCanUseDevice(user.id, storeId, device.id)) {
          return { device, created: false };
        }
      }
      return null;
    }
    return { device: preferred, created: false };
  }

  // First-run bootstrap: create a single register for the store.
  const { createDevice } = await import("@/modules/system/services/users.service");
  try {
    const device = await createDevice({ storeId, name: DEFAULT_DEVICE_NAME }, user.id);
    return { device, created: true };
  } catch (error) {
    console.error("[pos] implicit device create failed", error);
    return null;
  }
}

/**
 * Bind the current browser to a store register without pairing UX.
 * Safe to call from server actions / mutation paths that may set cookies.
 */
export async function ensureImplicitPosDeviceBinding(
  user: AppUser,
  options: { storeId?: string | null; writeAudit?: boolean } = {}
): Promise<ImplicitPosDeviceResult> {
  if (!IMPLICIT_POS_DEVICE_BINDING) {
    return { ok: false, reason: "no_device" };
  }

  await resumePosSessionForUser(user);

  const storeId = await resolveStoreId(user, options.storeId);
  if (!storeId) {
    return { ok: false, reason: "store_required" };
  }

  const existing = await getRegisteredDeviceContext();
  if (existing?.storeId === storeId) {
    const device = await deviceRepo.getDevice(existing.deviceId);
    if (device?.is_active && device.store_id === storeId) {
      if (user.role !== "cashier" || (await deviceRepo.cashierCanUseDevice(user.id, storeId, device.id))) {
        // Keep cashier cookie untouched — unlock happens via PIN only.
        return { ok: true, storeId, deviceId: device.id, createdDevice: false };
      }
    }
  }

  if (existing && existing.storeId !== storeId) {
    await clearRegisteredDeviceCookie();
    await setActiveCashierId(null);
  }

  const picked = await pickOrCreateDevice(user, storeId);
  if (!picked) {
    return { ok: false, reason: user.role === "cashier" ? "access_denied" : "no_device" };
  }

  await setRegisteredDeviceCookie({ deviceId: picked.device.id, storeId });
  await setActiveStoreCookie(storeId);
  // Never auto-unlock a cashier; PIN gate owns sf_active_cashier.

  if (options.writeAudit !== false) {
    try {
      const orgId = await getOrgId();
      await writeAuditLog({
        orgId,
        storeId,
        userId: user.id,
        action: "device.registered_browser",
        entityType: "device",
        entityId: picked.device.id,
        metadata: {
          via: "implicit_auto_bind",
          createdDevice: picked.created,
        },
      });
    } catch {
      // audit optional when org context is unavailable
    }
  }

  return {
    ok: true,
    storeId,
    deviceId: picked.device.id,
    createdDevice: picked.created,
  };
}
