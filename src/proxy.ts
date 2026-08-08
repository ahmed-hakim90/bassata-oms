import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createSignedCookieValueEdge } from "@/lib/auth/signed-cookie-edge";
import {
  HOST_ORG_COOKIE,
  isReservedHostname,
  normalizeHostname,
} from "@/lib/tenancy/custom-domain";
import { lookupOrgByHostname } from "@/lib/tenancy/host-org-lookup";
import { isSlugPosPath } from "@/lib/tenancy/pos-store-slug";

const HOST_ORG_COOKIE_MAX_AGE = 60 * 60 * 12;

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/auth",
  "/menu",
  "/track",
  "/domain-unavailable",
  // Hub that points operators at /{slug}/pos
  "/pos",
];

function isPublicPath(pathname: string) {
  if (isSlugPosPath(pathname)) return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function requestHostname(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  return normalizeHostname(forwarded ?? request.headers.get("host"));
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

  const hostname = requestHostname(request);
  const onCustomHost = Boolean(hostname && !isReservedHostname(hostname));

  // Custom domain: platform control plane stays on the canonical app host.
  if (onCustomHost && pathname.startsWith("/platform")) {
    return NextResponse.redirect(new URL("/domain-unavailable?reason=platform", request.url));
  }

  let hostBinding: Awaited<ReturnType<typeof lookupOrgByHostname>> = null;
  if (onCustomHost && hostname) {
    hostBinding = await lookupOrgByHostname(hostname);

    if (!hostBinding || hostBinding.domainStatus !== "active") {
      if (!pathname.startsWith("/domain-unavailable")) {
        return NextResponse.redirect(
          new URL("/domain-unavailable?reason=unverified", request.url)
        );
      }
    } else if (hostBinding.orgStatus === "suspended") {
      if (!pathname.startsWith("/domain-unavailable")) {
        return NextResponse.redirect(
          new URL("/domain-unavailable?reason=suspended", request.url)
        );
      }
    }
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

  const response = supabaseResponse;
  response.headers.set("x-pathname", pathname);
  response.headers.set("x-search", request.nextUrl.search);
  if (hostname) {
    response.headers.set("x-request-host", hostname);
  }

  if (
    hostBinding &&
    hostBinding.domainStatus === "active" &&
    hostBinding.orgStatus !== "suspended"
  ) {
    response.headers.set("x-host-org-id", hostBinding.orgId);
    const cookieValue = await createSignedCookieValueEdge(
      {
        orgId: hostBinding.orgId,
        host: hostBinding.host,
      },
      HOST_ORG_COOKIE_MAX_AGE
    );
    response.cookies.set(HOST_ORG_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: HOST_ORG_COOKIE_MAX_AGE,
    });
  } else if (!onCustomHost) {
    response.cookies.set(HOST_ORG_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
