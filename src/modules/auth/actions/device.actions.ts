"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { setActiveStoreCookie } from "@/lib/auth/guards";
import {
  clearRegisteredDeviceCookie,
  setActiveCashierId,
  setRegisteredDeviceCookie,
} from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { getCurrentUser } from "@/lib/auth/session";

export interface DeviceActionResult {
  success: boolean;
  error?: string;
}

export async function pairDeviceWithCodeAction(code: string): Promise<DeviceActionResult> {
  const trimmed = code.trim();
  if (!trimmed) return { success: false, error: "Enter a pairing code." };
  try {
    const { requireAuth } = await import("@/lib/auth/guards");
    await requireAuth();
    const { deviceId, storeId } = await deviceRepo.consumePairingCode(trimmed);
    await setRegisteredDeviceCookie({ deviceId, storeId });
    await setActiveStoreCookie(storeId);
    await setActiveCashierId(null);
    try {
      const orgId = await getOrgId();
      const user = await getCurrentUser();
      await writeAuditLog({
        orgId,
        storeId,
        userId: user?.id ?? deviceId,
        action: "device.paired",
        entityType: "device",
        entityId: deviceId,
        metadata: { via: "pairing_code" },
      });
    } catch {
      // audit optional when unauthenticated kiosk pairing
    }
    revalidatePath("/pos");
    revalidatePath("/sessions");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Invalid or expired pairing code",
    };
  }
}

export async function registerBrowserDeviceAction(deviceId: string): Promise<DeviceActionResult> {
  try {
    const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
    const device = await deviceRepo.getDevice(deviceId);
    if (!device || !device.is_active) {
      return { success: false, error: "Device not found or inactive" };
    }
    if (user.role !== "owner" && !user.store_ids.includes(device.store_id)) {
      return { success: false, error: "You do not have access to this store" };
    }
    await setRegisteredDeviceCookie({ deviceId: device.id, storeId: device.store_id });
    await setActiveStoreCookie(device.store_id);
    await setActiveCashierId(null);
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: device.store_id,
      userId: user.id,
      action: "device.registered_browser",
      entityType: "device",
      entityId: device.id,
    });
    revalidatePath("/pos");
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not register device",
    };
  }
}

export async function clearDeviceRegistrationAction(): Promise<void> {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const deviceCtx = await import("@/lib/auth/session").then((m) =>
    m.getRegisteredDeviceContext()
  );
  await clearRegisteredDeviceCookie();
  await setActiveCashierId(null);
  if (deviceCtx) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: deviceCtx.storeId,
      userId: user.id,
      action: "device.cleared",
      entityType: "device",
      entityId: deviceCtx.deviceId,
    });
  }
  revalidatePath("/pos");
  revalidatePath("/settings");
}

export async function switchCashierStoreAction(storeId: string): Promise<DeviceActionResult> {
  try {
    const { requireAuth, requireStoreAccess } = await import("@/lib/auth/guards");
    const user = await requireAuth();
    await requireStoreAccess(storeId);
    if (user.role === "cashier" && !user.store_ids.includes(storeId)) {
      return { success: false, error: "Store access denied" };
    }
    const deviceCtx = await import("@/lib/auth/session").then((m) => m.getRegisteredDeviceContext());
    if (deviceCtx && deviceCtx.storeId !== storeId) {
      return {
        success: false,
        error: "This device is registered to another store. Pair again for that branch.",
      };
    }
    await setActiveStoreCookie(storeId);
    await setActiveCashierId(null);
    revalidatePath("/pos");
    revalidatePath("/sessions");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not switch store",
    };
  }
}

export async function selectCashierStoreAndContinueAction(storeId: string) {
  const result = await switchCashierStoreAction(storeId);
  if (!result.success) throw new Error(result.error ?? "Store selection failed");
  const deviceCtx = await import("@/lib/auth/session").then((m) => m.getRegisteredDeviceContext());
  if (!deviceCtx) {
    redirect("/device/pair?from=/pos");
  }
  redirect("/pos");
}
