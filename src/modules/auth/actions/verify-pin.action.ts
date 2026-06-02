"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getRegisteredDeviceContext,
  setActiveCashierId,
  getCurrentUser,
  getActiveStoreId,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";

export interface VerifyPinResult {
  success: boolean;
  error?: string;
  cashierId?: string;
}

export async function verifyPinAction(pin: string): Promise<VerifyPinResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "You must be signed in." };
  }

  if (!pin || pin.length < 4) {
    return { success: false, error: "Enter a valid PIN." };
  }

  const storeId = await getActiveStoreId();
  if (!storeId) {
    return { success: false, error: "No active store selected." };
  }

  const deviceCtx = await getRegisteredDeviceContext();
  if (!deviceCtx || deviceCtx.storeId !== storeId) {
    return { success: false, error: "Register this device before switching cashier." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_cashier_pin", {
    p_store_id: storeId,
    p_pin: pin,
    p_device_id: deviceCtx.deviceId,
  });

  if (error || !data) {
    try {
      const orgId = await getOrgId();
      await writeAuditLog({
        orgId,
        storeId,
        userId: user.id,
        action: "cashier.pin_failed",
        entityType: "user",
        entityId: user.id,
        metadata: { deviceId: deviceCtx.deviceId },
      });
    } catch {
      // ignore audit errors
    }
    return { success: false, error: "Incorrect PIN." };
  }

  const cashierId = data as string;
  await setActiveCashierId(cashierId, {
    storeId,
    deviceId: deviceCtx.deviceId,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId,
    userId: cashierId,
    action: "cashier.pin_verified",
    entityType: "user",
    entityId: cashierId,
    metadata: { verifiedBy: user.id, deviceId: deviceCtx.deviceId },
  });

  return { success: true, cashierId };
}
