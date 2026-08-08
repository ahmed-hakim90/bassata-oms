import { cookies, headers } from "next/headers";
import { readSignedCookieValue } from "@/lib/auth/signed-cookie";
import { HOST_ORG_COOKIE } from "@/lib/tenancy/custom-domain";

export type HostOrgCookiePayload = {
  orgId: string;
  host: string;
};

/** Host-bound org from proxy cookie, or x-host-org-id header as fallback. */
export async function getHostBoundOrgId(): Promise<string | null> {
  const headerList = await headers();
  const fromHeader = headerList.get("x-host-org-id")?.trim();
  if (fromHeader) return fromHeader;

  const jar = await cookies();
  const payload = readSignedCookieValue<HostOrgCookiePayload>(
    jar.get(HOST_ORG_COOKIE)?.value
  );
  return payload?.orgId ?? null;
}

export async function assertUserMatchesHostOrg(userOrgId: string): Promise<void> {
  const hostOrgId = await getHostBoundOrgId();
  if (hostOrgId && hostOrgId !== userOrgId) {
    const { AuthError } = await import("@/lib/auth/auth-error");
    throw new AuthError("هذا الحساب لا يتبع دومين هذه الشركة", 403);
  }
}
