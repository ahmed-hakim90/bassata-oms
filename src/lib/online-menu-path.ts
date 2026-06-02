import type { Store } from "@/lib/types";

/** URL segment for a branch public menu (letters, numbers, hyphens; Arabic supported). */
export const MENU_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function normalizeMenuSlug(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugifyBranchName(name: string, storeId?: string): string {
  const fromName = normalizeMenuSlug(
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
  );
  if (fromName.length >= 2) return fromName;
  const short = storeId?.replaceAll("-", "").slice(-8) ?? "menu";
  return `branch-${short}`;
}

export function validateMenuSlug(slug: string): string | null {
  const normalized = normalizeMenuSlug(slug);
  if (normalized.length < 2) return "Menu link name must be at least 2 characters";
  if (normalized.length > 64) return "Menu link name must be 64 characters or less";
  if (!MENU_SLUG_PATTERN.test(normalized)) {
    return "Use letters, numbers, and hyphens only";
  }
  return null;
}

export function getStoreMenuSlug(store: Store): string {
  const slug = store.settings.online_menu_slug;
  if (typeof slug === "string" && slug.length > 0) return slug;
  return slugifyBranchName(store.name, store.id);
}

export function getStoreMenuPath(store: Store): string {
  return `/menu/${getStoreMenuSlug(store)}`;
}

export function getOnlineMenuToken(store: Store): string {
  const token = store.settings.online_menu_token;
  return typeof token === "string" && token.length > 0
    ? token
    : store.id.replaceAll("-", "");
}
