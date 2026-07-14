import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { readSignedCookieValueEdge } from "@/lib/auth/signed-cookie-edge";

const REGISTERED_DEVICE_COOKIE = "sf_registered_device";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/auth",
  "/menu",
  "/track",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

async function hasValidRegisteredDeviceCookie(request: NextRequest): Promise<boolean> {
  const payload = await readSignedCookieValueEdge<{ deviceId?: string; storeId?: string }>(
    request.cookies.get(REGISTERED_DEVICE_COOKIE)?.value
  );
  return Boolean(payload?.deviceId && payload?.storeId);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const { response: supabaseResponse, hasSession: hasAuthSession } =
    await updateSession(request);

  const isPublic = isPublicPath(pathname);

  if (!hasAuthSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Skip bounce when landing after forced sign-out / auth errors (avoids stale-cookie loops).
  if (hasAuthSession && pathname === "/login") {
    const { searchParams } = request.nextUrl;
    if (!searchParams.has("error") && !searchParams.has("signedout")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  const needsDevice =
    pathname.startsWith("/pos") ||
    (pathname.startsWith("/sessions") && hasAuthSession);

  if (hasAuthSession && needsDevice && !(await hasValidRegisteredDeviceCookie(request))) {
    if (!pathname.startsWith("/device/pair") && !pathname.startsWith("/pos")) {
      const pairUrl = new URL("/device/pair", request.url);
      pairUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(pairUrl);
    }
  }

  // /platform: auth required (above). Platform-admin authorization is enforced in (platform) layout.

  const response = supabaseResponse;
  response.headers.set("x-pathname", pathname);
  response.headers.set("x-search", request.nextUrl.search);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
