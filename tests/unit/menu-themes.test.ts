import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_THEME_SLUG,
  getMenuTheme,
  isMenuThemeSlug,
  MENU_THEME_SLUGS,
  parseOnlineMenuTheme,
} from "@/modules/online-menu/lib/menu-themes";

describe("menu themes", () => {
  it("lists every defined theme slug", () => {
    expect(MENU_THEME_SLUGS.sort()).toEqual(
      ["antika", "bistro", "classic", "minimal", "soul"].sort()
    );
  });

  it("accepts known slugs and rejects unknown", () => {
    expect(isMenuThemeSlug("bistro")).toBe(true);
    expect(isMenuThemeSlug("neon")).toBe(false);
  });

  it("falls back to classic for null/unknown slug", () => {
    expect(getMenuTheme(null).slug).toBe("classic");
    expect(getMenuTheme("nope").slug).toBe("classic");
    expect(getMenuTheme("soul").slug).toBe("soul");
  });

  it("reads online_menu_theme from store settings safely", () => {
    expect(parseOnlineMenuTheme({ online_menu_theme: "antika" })).toBe("antika");
    expect(parseOnlineMenuTheme({ online_menu_theme: "hack" })).toBe(DEFAULT_MENU_THEME_SLUG);
    expect(parseOnlineMenuTheme(null)).toBe(DEFAULT_MENU_THEME_SLUG);
    expect(parseOnlineMenuTheme({ online_menu_theme: 1 })).toBe(DEFAULT_MENU_THEME_SLUG);
  });

  it("keeps minimal theme without product images", () => {
    expect(getMenuTheme("minimal").showImages).toBe(false);
    expect(getMenuTheme("classic").showImages).toBe(true);
  });
});
