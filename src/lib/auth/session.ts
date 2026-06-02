import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import * as userRepo from "@/lib/repositories/user.repository";
import { createSignedCookieValue, readSignedCookieValue } from "@/lib/auth/signed-cookie";
import { isOrganizationSuspended } from "@/lib/platform/company-status";
import type { AppUser } from "@/lib/types";

export const STORE_COOKIE = "sf_active_store";
export const REGISTERED_DEVICE_COOKIE = "sf_registered_device";
/** @deprecated Use REGISTERED_DEVICE_COOKIE */
export const DEVICE_COOKIE = REGISTERED_DEVICE_COOKIE;
export const CASHIER_COOKIE = "sf_active_cashier";

const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CASHIER_COOKIE_MAX_AGE = 60 * 60 * 12;

export async function getCurrentUser(): Promise<AppUser | null> {
  const db = await createClient();
  const {
    data: { user: authUser },
  } = await db.auth.getUser();
  if (!authUser) return null;
  const appUser = await userRepo.getUserByAuthId(authUser.id);
  if (appUser && (await isOrganizationSuspended(appUser.org_id))) return null;
  return appUser;
}

export async function getActiveStoreId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(STORE_COOKIE)?.value ?? null;
}

export async function getRegisteredDeviceContext(): Promise<{
  deviceId: string;
  storeId: string;
} | null> {
  const cookieStore = await cookies();
  const payload = readSignedCookieValue<{ deviceId?: string; storeId?: string }>(
    cookieStore.get(REGISTERED_DEVICE_COOKIE)?.value
  );
  if (!payload?.deviceId || !payload?.storeId) return null;
  return { deviceId: payload.deviceId, storeId: payload.storeId };
}

/** @deprecated Use getRegisteredDeviceContext */
export async function isDeviceUnlocked(): Promise<boolean> {
  return Boolean(await getRegisteredDeviceContext());
}

/** @deprecated Use getRegisteredDeviceContext */
export async function getUnlockedDeviceContext(): Promise<{
  storeId: string;
  deviceId: string | null;
  unlockedBy: string;
} | null> {
  const ctx = await getRegisteredDeviceContext();
  if (!ctx) return null;
  return {
    storeId: ctx.storeId,
    deviceId: ctx.deviceId,
    unlockedBy: "",
  };
}

export async function setRegisteredDeviceCookie(input: {
  deviceId: string;
  storeId: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set(
    REGISTERED_DEVICE_COOKIE,
    createSignedCookieValue(
      { deviceId: input.deviceId, storeId: input.storeId },
      DEVICE_COOKIE_MAX_AGE
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    }
  );
}

export async function clearRegisteredDeviceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(REGISTERED_DEVICE_COOKIE);
}

/** @deprecated Use setRegisteredDeviceCookie */
export async function setDeviceUnlocked(
  value: boolean,
  input?: { storeId: string; deviceId: string | null; unlockedBy: string }
) {
  if (value && input?.deviceId) {
    await setRegisteredDeviceCookie({
      deviceId: input.deviceId,
      storeId: input.storeId,
    });
  } else {
    await clearRegisteredDeviceCookie();
  }
}

export async function getActiveCashierId(
  storeId: string,
  deviceId: string,
  _user: AppUser
): Promise<string | null> {
  void _user;
  const cookieStore = await cookies();
  const payload = readSignedCookieValue<{
    cashierId?: string;
    storeId?: string;
    deviceId?: string;
  }>(cookieStore.get(CASHIER_COOKIE)?.value);

  if (
    payload?.cashierId &&
    payload.storeId === storeId &&
    payload.deviceId === deviceId
  ) {
    return payload.cashierId;
  }
  return null;
}

/** @deprecated Use getActiveCashierId with user context */
export async function getVerifiedActiveCashierId(storeId: string): Promise<string | null> {
  const user = await getCurrentUser();
  const deviceCtx = await getRegisteredDeviceContext();
  if (!user || !deviceCtx || deviceCtx.storeId !== storeId) return null;
  return getActiveCashierId(storeId, deviceCtx.deviceId, user);
}

export async function setActiveCashierId(
  cashierId: string | null,
  input?: { storeId: string; deviceId: string }
) {
  const cookieStore = await cookies();
  if (cashierId && input) {
    cookieStore.set(
      CASHIER_COOKIE,
      createSignedCookieValue(
        { cashierId, storeId: input.storeId, deviceId: input.deviceId },
        CASHIER_COOKIE_MAX_AGE
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CASHIER_COOKIE_MAX_AGE,
      }
    );
  } else {
    cookieStore.delete(CASHIER_COOKIE);
  }
}
