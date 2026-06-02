import { cookies } from "next/headers";
import { createSignedCookieValue, readSignedCookieValue } from "@/lib/auth/signed-cookie";

export const PLATFORM_SUPPORT_COOKIE = "sf_platform_support";
const SUPPORT_MAX_AGE = 60 * 30;

export interface PlatformSupportSession {
  platformAdminId: string;
  orgId: string;
  reason: string;
  mode: "view";
}

export async function setPlatformSupportSession(input: PlatformSupportSession) {
  const cookieStore = await cookies();
  cookieStore.set(
    PLATFORM_SUPPORT_COOKIE,
    createSignedCookieValue({ ...input }, SUPPORT_MAX_AGE),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SUPPORT_MAX_AGE,
    }
  );
}

export async function getPlatformSupportSession(): Promise<PlatformSupportSession | null> {
  const cookieStore = await cookies();
  const payload = readSignedCookieValue<Partial<PlatformSupportSession>>(
    cookieStore.get(PLATFORM_SUPPORT_COOKIE)?.value
  );
  if (
    !payload?.platformAdminId ||
    !payload.orgId ||
    !payload.reason ||
    payload.mode !== "view"
  ) {
    return null;
  }
  return {
    platformAdminId: payload.platformAdminId,
    orgId: payload.orgId,
    reason: payload.reason,
    mode: "view",
  };
}

export async function clearPlatformSupportSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PLATFORM_SUPPORT_COOKIE);
}
