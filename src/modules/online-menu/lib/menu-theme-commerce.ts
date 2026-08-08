import {
  DEFAULT_MENU_THEME_SLUG,
  MENU_THEME_SLUGS,
  MENU_THEMES,
  isMenuThemeSlug,
  type MenuThemeSlug,
} from "@/modules/online-menu/lib/menu-themes";

/** Platform catalog key in `platform_settings`. */
export const MENU_THEME_CATALOG_KEY = "menu_theme_catalog";

/** Per-org entitlements key in `app_settings`. */
export const MENU_THEME_ENTITLEMENTS_KEY = "menu_theme_entitlements";

export type MenuThemeCatalogEntry = {
  slug: MenuThemeSlug;
  /** Display / billing list price in EGP (manual SaaS ops — not charged in-app). */
  priceEgp: number;
  /** When false, theme cannot be newly entitled unless platform re-enables globally. */
  globallyAvailable: boolean;
  notes: string;
};

export type MenuThemeCatalog = Record<MenuThemeSlug, MenuThemeCatalogEntry>;

export type MenuThemeEntitlements = {
  /** Themes the org may activate on stores. */
  enabledThemes: MenuThemeSlug[];
  notes: string;
};

export type MenuThemeAccessRow = {
  slug: MenuThemeSlug;
  nameAr: string;
  descriptionAr: string;
  priceEgp: number;
  globallyAvailable: boolean;
  enabledForOrg: boolean;
  notes: string;
};

/** Defaults: free classics enabled; premium priced but still entitled (compat). */
export const DEFAULT_MENU_THEME_CATALOG: MenuThemeCatalog = {
  classic: {
    slug: "classic",
    priceEgp: 0,
    globallyAvailable: true,
    notes: "افتراضي مجاني",
  },
  minimal: {
    slug: "minimal",
    priceEgp: 0,
    globallyAvailable: true,
    notes: "مجاني",
  },
  antika: {
    slug: "antika",
    priceEgp: 199,
    globallyAvailable: true,
    notes: "",
  },
  bistro: {
    slug: "bistro",
    priceEgp: 199,
    globallyAvailable: true,
    notes: "",
  },
  soul: {
    slug: "soul",
    priceEgp: 249,
    globallyAvailable: true,
    notes: "",
  },
};

/** Backward compatible: every known theme enabled until platform narrows access. */
export const DEFAULT_MENU_THEME_ENTITLEMENTS: MenuThemeEntitlements = {
  enabledThemes: [...MENU_THEME_SLUGS],
  notes: "",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function normalizeMenuThemeCatalog(value: unknown): MenuThemeCatalog {
  const raw = asRecord(value);
  const next = { ...DEFAULT_MENU_THEME_CATALOG };
  for (const slug of MENU_THEME_SLUGS) {
    const entry = asRecord(raw[slug]);
    next[slug] = {
      slug,
      priceEgp:
        entry.priceEgp !== undefined
          ? normalizePrice(entry.priceEgp)
          : DEFAULT_MENU_THEME_CATALOG[slug].priceEgp,
      globallyAvailable:
        typeof entry.globallyAvailable === "boolean"
          ? entry.globallyAvailable
          : DEFAULT_MENU_THEME_CATALOG[slug].globallyAvailable,
      notes:
        typeof entry.notes === "string"
          ? entry.notes.trim()
          : DEFAULT_MENU_THEME_CATALOG[slug].notes,
    };
  }
  return next;
}

export function normalizeMenuThemeEntitlements(value: unknown): MenuThemeEntitlements {
  const raw = asRecord(value);
  const list = Array.isArray(raw.enabledThemes)
    ? raw.enabledThemes
    : Array.isArray(raw.enabled_themes)
      ? raw.enabled_themes
      : null;

  const enabledThemes = list
    ? list.filter((item): item is MenuThemeSlug => typeof item === "string" && isMenuThemeSlug(item))
    : [...DEFAULT_MENU_THEME_ENTITLEMENTS.enabledThemes];

  const unique = Array.from(new Set(enabledThemes));
  if (!unique.includes(DEFAULT_MENU_THEME_SLUG)) {
    unique.unshift(DEFAULT_MENU_THEME_SLUG);
  }

  return {
    enabledThemes: unique,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
  };
}

export function isMenuThemeEnabledForOrg(
  entitlements: MenuThemeEntitlements,
  catalog: MenuThemeCatalog,
  slug: string
): boolean {
  if (!isMenuThemeSlug(slug)) return false;
  if (!catalog[slug].globallyAvailable && slug !== DEFAULT_MENU_THEME_SLUG) return false;
  return entitlements.enabledThemes.includes(slug);
}

export function resolveEntitledMenuTheme(
  requested: string | null | undefined,
  entitlements: MenuThemeEntitlements,
  catalog: MenuThemeCatalog
): MenuThemeSlug {
  if (
    requested &&
    isMenuThemeSlug(requested) &&
    isMenuThemeEnabledForOrg(entitlements, catalog, requested)
  ) {
    return requested;
  }
  return DEFAULT_MENU_THEME_SLUG;
}

export function buildMenuThemeAccessRows(
  catalog: MenuThemeCatalog,
  entitlements: MenuThemeEntitlements
): MenuThemeAccessRow[] {
  return MENU_THEME_SLUGS.map((slug) => {
    const def = MENU_THEMES[slug];
    const entry = catalog[slug];
    return {
      slug,
      nameAr: def.nameAr,
      descriptionAr: def.descriptionAr,
      priceEgp: entry.priceEgp,
      globallyAvailable: entry.globallyAvailable,
      enabledForOrg: isMenuThemeEnabledForOrg(entitlements, catalog, slug),
      notes: entry.notes,
    };
  });
}

export function formatMenuThemePriceEgp(priceEgp: number): string {
  if (priceEgp <= 0) return "مجاني";
  return `${priceEgp.toLocaleString("ar-EG")} ج.م`;
}
