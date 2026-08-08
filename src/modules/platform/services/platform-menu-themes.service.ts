import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  MENU_THEME_CATALOG_KEY,
  MENU_THEME_ENTITLEMENTS_KEY,
  buildMenuThemeAccessRows,
  normalizeMenuThemeCatalog,
  normalizeMenuThemeEntitlements,
  type MenuThemeAccessRow,
  type MenuThemeCatalog,
  type MenuThemeCatalogEntry,
  type MenuThemeEntitlements,
} from "@/modules/online-menu/lib/menu-theme-commerce";
import type { MenuThemeSlug } from "@/modules/online-menu/lib/menu-themes";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export async function getMenuThemeCatalog(): Promise<MenuThemeCatalog> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", MENU_THEME_CATALOG_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeMenuThemeCatalog(data?.value ?? null);
}

export async function setMenuThemeCatalog(
  platformAdmin: PlatformAdmin,
  catalog: MenuThemeCatalog
): Promise<MenuThemeCatalog> {
  const normalized = normalizeMenuThemeCatalog(catalog);
  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      key: MENU_THEME_CATALOG_KEY,
      value: normalized as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "menu_themes.catalog_update",
    entityType: "platform_settings",
    entityId: MENU_THEME_CATALOG_KEY,
    metadata: {
      prices: Object.fromEntries(
        Object.values(normalized).map((row) => [
          row.slug,
          { priceEgp: row.priceEgp, globallyAvailable: row.globallyAvailable },
        ])
      ),
    },
  });

  return normalized;
}

export async function updateMenuThemeCatalogEntries(
  platformAdmin: PlatformAdmin,
  updates: Partial<Record<MenuThemeSlug, Partial<MenuThemeCatalogEntry>>>
): Promise<MenuThemeCatalog> {
  const current = await getMenuThemeCatalog();
  const next: MenuThemeCatalog = { ...current };
  for (const [slug, patch] of Object.entries(updates) as [
    MenuThemeSlug,
    Partial<MenuThemeCatalogEntry>,
  ][]) {
    if (!next[slug] || !patch) continue;
    next[slug] = {
      ...next[slug],
      ...patch,
      slug,
    };
  }
  return setMenuThemeCatalog(platformAdmin, next);
}

export async function getOrgMenuThemeEntitlements(
  orgId: string
): Promise<MenuThemeEntitlements> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", MENU_THEME_ENTITLEMENTS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeMenuThemeEntitlements(data?.value ?? null);
}

export async function setOrgMenuThemeEntitlements(
  platformAdmin: PlatformAdmin,
  orgId: string,
  entitlements: MenuThemeEntitlements
): Promise<MenuThemeEntitlements> {
  const normalized = normalizeMenuThemeEntitlements(entitlements);
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      org_id: orgId,
      key: MENU_THEME_ENTITLEMENTS_KEY,
      value: {
        enabledThemes: normalized.enabledThemes,
        notes: normalized.notes,
      } as unknown as Json,
    },
    { onConflict: "org_id,key" }
  );
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "menu_themes.entitlements_update",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      enabledThemes: normalized.enabledThemes,
      notes: normalized.notes,
    },
  });

  return normalized;
}

export async function getOrgMenuThemeAccess(
  orgId: string
): Promise<{
  catalog: MenuThemeCatalog;
  entitlements: MenuThemeEntitlements;
  rows: MenuThemeAccessRow[];
}> {
  const [catalog, entitlements] = await Promise.all([
    getMenuThemeCatalog(),
    getOrgMenuThemeEntitlements(orgId),
  ]);
  return {
    catalog,
    entitlements,
    rows: buildMenuThemeAccessRows(catalog, entitlements),
  };
}

/**
 * Tenant-safe read for settings UI / save guards.
 * Uses admin client only for platform_settings + org-scoped entitlements.
 */
export async function getTenantMenuThemeAccess(orgId: string) {
  return getOrgMenuThemeAccess(orgId);
}
