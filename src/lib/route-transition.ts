export type InternalNavigationClick = {
  href: string | null;
  currentPathname: string;
  origin: string;
  target: string | null;
  download: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type RouteLoadingKind = "page" | "pos" | "auth";

export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isCustomerFacingPath(pathname: string): boolean {
  return (
    pathname === "/menu" ||
    pathname.startsWith("/menu/") ||
    pathname.startsWith("/track/")
  );
}

export function isPosDestinationPath(pathname: string): boolean {
  return (
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    /^\/[^/]+\/pos(?:\/|$)/.test(pathname)
  );
}

export function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/device")
  );
}

export function routeLoadingKind(pathname: string): RouteLoadingKind {
  if (isPosDestinationPath(pathname)) return "pos";
  if (isAuthPath(pathname)) return "auth";
  return "page";
}

export function shouldShowRouteSkeleton(pathname: string): boolean {
  return !isCustomerFacingPath(pathname);
}

/**
 * Destination pathname for an in-app left-click, or null when the click
 * should not replace the current page with a route skeleton.
 */
export function resolveInternalNavigationPath(
  input: InternalNavigationClick
): string | null {
  if (input.button !== 0) return null;
  if (input.metaKey || input.ctrlKey || input.shiftKey || input.altKey) {
    return null;
  }
  if (input.download) return null;
  if (input.target && input.target !== "_self") return null;
  if (!input.href) return null;

  let url: URL;
  try {
    url = new URL(input.href, input.origin);
  } catch {
    return null;
  }

  if (url.origin !== input.origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!shouldShowRouteSkeleton(url.pathname)) return null;

  const nextPath = normalizePathname(url.pathname);
  const currentPath = normalizePathname(input.currentPathname);
  if (nextPath === currentPath) return null;

  return url.pathname;
}
