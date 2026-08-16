import { describe, expect, it } from "vitest";
import {
  isAuthPath,
  isCustomerFacingPath,
  isPosDestinationPath,
  resolveInternalNavigationPath,
  routeLoadingKind,
  shouldShowRouteSkeleton,
} from "@/lib/route-transition";

const origin = "https://velora.example";

function click(
  overrides: Partial<Parameters<typeof resolveInternalNavigationPath>[0]> = {}
) {
  return resolveInternalNavigationPath({
    href: "/products",
    currentPathname: "/orders",
    origin,
    target: null,
    download: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  });
}

describe("resolveInternalNavigationPath", () => {
  it("returns the destination path for an in-app page click", () => {
    expect(click()).toBe("/products");
  });

  it("ignores same-page clicks including trailing slash and search-only changes", () => {
    expect(click({ href: "/orders", currentPathname: "/orders" })).toBeNull();
    expect(click({ href: "/orders/", currentPathname: "/orders" })).toBeNull();
    expect(click({ href: "/orders?status=open", currentPathname: "/orders" })).toBeNull();
    expect(click({ href: "/orders#top", currentPathname: "/orders" })).toBeNull();
  });

  it("treats nested entity paths as a real page change", () => {
    expect(
      click({ href: "/customers/abc", currentPathname: "/customers" })
    ).toBe("/customers/abc");
  });

  it("ignores new-tab, download, and modified clicks", () => {
    expect(click({ target: "_blank" })).toBeNull();
    expect(click({ download: true })).toBeNull();
    expect(click({ metaKey: true })).toBeNull();
    expect(click({ ctrlKey: true })).toBeNull();
    expect(click({ button: 1 })).toBeNull();
  });

  it("ignores external, non-http, and customer-facing URLs", () => {
    expect(click({ href: "https://example.com/products" })).toBeNull();
    expect(click({ href: "mailto:ops@example.com" })).toBeNull();
    expect(click({ href: "javascript:void(0)" })).toBeNull();
    expect(click({ href: "/menu/store-a", currentPathname: "/menu" })).toBeNull();
    expect(click({ href: "/track/abc", currentPathname: "/orders" })).toBeNull();
  });
});

describe("route loading kind", () => {
  it("classifies operator, POS, and auth destinations", () => {
    expect(routeLoadingKind("/products")).toBe("page");
    expect(routeLoadingKind("/pos")).toBe("pos");
    expect(routeLoadingKind("/downtown/pos")).toBe("pos");
    expect(routeLoadingKind("/login")).toBe("auth");
    expect(routeLoadingKind("/forgot-password")).toBe("auth");
  });

  it("keeps public customer surfaces out of the operator skeleton", () => {
    expect(isCustomerFacingPath("/menu/store-a")).toBe(true);
    expect(isPosDestinationPath("/pos")).toBe(true);
    expect(isAuthPath("/onboarding")).toBe(true);
    expect(shouldShowRouteSkeleton("/menu/store-a")).toBe(false);
    expect(shouldShowRouteSkeleton("/orders")).toBe(true);
  });
});
