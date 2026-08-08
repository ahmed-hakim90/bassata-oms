import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOnlineMenuSlug } from "@/lib/slugify";
import type { Json } from "@/lib/supabase/database.types";

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Top-level segments that must never be treated as a store POS slug. */
export const RESERVED_POS_SLUGS = new Set([
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "onboarding",
  "auth",
  "menu",
  "track",
  "domain-unavailable",
  "pos",
  "platform",
  "api",
  "settings",
  "users",
  "products",
  "inventory",
  "orders",
  "customers",
  "reports",
  "expenses",
  "accounting",
  "sessions",
  "devices",
  "kitchen",
  "labels",
  "guide",
  "audit",
  "promotions",
  "sales-invoices",
  "online-orders",
  "monthly-closing",
  "_next",
  "favicon.ico",
]);

export type PosStoreBySlug = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
};

export function isReservedPosSlug(slug: string): boolean {
  const normalized = normalizeOnlineMenuSlug(slug);
  if (!normalized) return true;
  return RESERVED_POS_SLUGS.has(normalized);
}

export function buildPosPathForSlug(slug: string): string {
  const normalized = normalizeOnlineMenuSlug(slug);
  return normalized ? `/${normalized}/pos` : "/pos";
}

/** True for `/{slug}/pos` public cashier entry (not bare `/pos`). */
export function isSlugPosPath(pathname: string): boolean {
  const match = pathname.match(/^\/([^/]+)\/pos(?:\/|$)/);
  if (!match?.[1]) return false;
  return !isReservedPosSlug(match[1]);
}

export function posSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/([^/]+)\/pos(?:\/|$)/);
  if (!match?.[1] || isReservedPosSlug(match[1])) return null;
  return normalizeOnlineMenuSlug(match[1]);
}

export async function resolveStoreByPosSlug(
  rawSlug: string
): Promise<PosStoreBySlug | null> {
  const slug = normalizeOnlineMenuSlug(rawSlug);
  if (!slug || isReservedPosSlug(slug)) return null;

  const admin = createAdminClient();
  const { data: store, error } = await admin
    .from("stores")
    .select("id, org_id, name, is_active, settings")
    .eq("is_active", true)
    .filter("settings->>online_menu_slug", "eq", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!store) return null;

  const settings = asRecord(store.settings);
  const storedSlug = normalizeOnlineMenuSlug(String(settings.online_menu_slug ?? ""));
  if (storedSlug !== slug) return null;

  return {
    id: store.id,
    orgId: store.org_id,
    name: store.name,
    slug: storedSlug,
  };
}

export function storePosSlugFromSettings(
  settings: Record<string, unknown> | null | undefined
): string | null {
  const slug = normalizeOnlineMenuSlug(String(settings?.online_menu_slug ?? ""));
  return slug && !isReservedPosSlug(slug) ? slug : null;
}
