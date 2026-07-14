export type MenuThemeLayout = "grid" | "list";

export type MenuThemeSlug = "classic" | "minimal" | "antika" | "bistro" | "soul";

export interface MenuThemeDefinition {
  slug: MenuThemeSlug;
  nameAr: string;
  descriptionAr: string;
  layout: MenuThemeLayout;
  /** Root class on the public menu shell. Null = default Meridian tokens. */
  cssClass: string | null;
  showImages: boolean;
  previewColors: {
    background: string;
    primary: string;
    accent: string;
  };
}

export const MENU_THEMES: Record<MenuThemeSlug, MenuThemeDefinition> = {
  classic: {
    slug: "classic",
    nameAr: "كلاسيك",
    descriptionAr: "بطاقات منتجات بصور — التصميم الافتراضي",
    layout: "grid",
    cssClass: null,
    showImages: true,
    previewColors: { background: "#f1f5f9", primary: "#0e7490", accent: "#0f172a" },
  },
  minimal: {
    slug: "minimal",
    nameAr: "بسيط",
    descriptionAr: "قائمة نظيفة بعمود واحد بدون صور",
    layout: "list",
    cssClass: "minimal-menu",
    showImages: false,
    previewColors: { background: "#ffffff", primary: "#18181b", accent: "#71717a" },
  },
  antika: {
    slug: "antika",
    nameAr: "أنتيكا",
    descriptionAr: "تصميم دافئ بألوان ذهبية وخطوط كلاسيكية",
    layout: "list",
    cssClass: "antika-menu",
    showImages: true,
    previewColors: { background: "#f5eee3", primary: "#b67b31", accent: "#2a160f" },
  },
  bistro: {
    slug: "bistro",
    nameAr: "بيسترو",
    descriptionAr: "مظهر داكن أنيق بذهبي — للمطاعم الراقية",
    layout: "grid",
    cssClass: "bistro-menu",
    showImages: true,
    previewColors: { background: "#141210", primary: "#c9a84c", accent: "#f5f0e8" },
  },
  soul: {
    slug: "soul",
    nameAr: "سول",
    descriptionAr: "تصميم داكن فاخر بخطوط ذهبية",
    layout: "list",
    cssClass: "soul-menu",
    showImages: true,
    previewColors: { background: "#1c1915", primary: "#d4af37", accent: "#f5f0e8" },
  },
};

export const MENU_THEME_SLUGS = Object.keys(MENU_THEMES) as MenuThemeSlug[];

export const DEFAULT_MENU_THEME_SLUG: MenuThemeSlug = "classic";

export function isMenuThemeSlug(value: string): value is MenuThemeSlug {
  return value in MENU_THEMES;
}

export function getMenuTheme(slug: string | null | undefined): MenuThemeDefinition {
  if (slug && isMenuThemeSlug(slug)) {
    return MENU_THEMES[slug];
  }
  return MENU_THEMES.classic;
}

/** Read theme from store.settings JSONB. */
export function parseOnlineMenuTheme(settings: Record<string, unknown> | null | undefined): MenuThemeSlug {
  const raw = settings?.online_menu_theme;
  if (typeof raw === "string" && isMenuThemeSlug(raw)) return raw;
  return DEFAULT_MENU_THEME_SLUG;
}
