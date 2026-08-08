import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_THEME_CATALOG,
  DEFAULT_MENU_THEME_ENTITLEMENTS,
  formatMenuThemePriceEgp,
  isMenuThemeEnabledForOrg,
  normalizeMenuThemeCatalog,
  normalizeMenuThemeEntitlements,
  resolveEntitledMenuTheme,
} from "@/modules/online-menu/lib/menu-theme-commerce";

describe("menu theme commerce", () => {
  it("normalizes catalog prices and availability", () => {
    const catalog = normalizeMenuThemeCatalog({
      soul: { priceEgp: 300, globallyAvailable: false },
    });
    expect(catalog.soul.priceEgp).toBe(300);
    expect(catalog.soul.globallyAvailable).toBe(false);
    expect(catalog.classic.priceEgp).toBe(DEFAULT_MENU_THEME_CATALOG.classic.priceEgp);
  });

  it("always keeps classic in entitlements", () => {
    const entitlements = normalizeMenuThemeEntitlements({
      enabledThemes: ["soul"],
    });
    expect(entitlements.enabledThemes).toContain("classic");
    expect(entitlements.enabledThemes).toContain("soul");
  });

  it("blocks globally unavailable themes except classic", () => {
    const catalog = normalizeMenuThemeCatalog({
      soul: { globallyAvailable: false },
    });
    const entitlements = DEFAULT_MENU_THEME_ENTITLEMENTS;
    expect(isMenuThemeEnabledForOrg(entitlements, catalog, "soul")).toBe(false);
    expect(isMenuThemeEnabledForOrg(entitlements, catalog, "classic")).toBe(true);
  });

  it("falls back to classic when requested theme is not entitled", () => {
    const catalog = normalizeMenuThemeCatalog(null);
    const entitlements = normalizeMenuThemeEntitlements({
      enabledThemes: ["classic", "minimal"],
    });
    expect(resolveEntitledMenuTheme("soul", entitlements, catalog)).toBe("classic");
    expect(resolveEntitledMenuTheme("minimal", entitlements, catalog)).toBe("minimal");
  });

  it("formats free and paid prices in Arabic", () => {
    expect(formatMenuThemePriceEgp(0)).toBe("مجاني");
    expect(formatMenuThemePriceEgp(199)).toContain("ج.م");
  });
});
