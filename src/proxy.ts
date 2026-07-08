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
  "/auth/callback",
  "/menu",
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

  const { response: supabaseResponse, user: authUser } = await updateSession(request);

  const hasAuthSession = Boolean(authUser);
  const isPublic = isPublicPath(pathname);

  if (!hasAuthSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasAuthSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
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

  const response = supabaseResponse;
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
