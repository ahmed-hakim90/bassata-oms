/** URL-safe slug from a branch or entity name. */
export function slugifyBranchName(name: string, storeId?: string): string {
  const fromName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "");
  if (fromName.length >= 2) return fromName;
  const short = storeId?.replaceAll("-", "").slice(-8) ?? "branch";
  return `branch-${short}`;
}

/**
 * Normalize a public menu slug from a route param or query.
 * Non-ASCII segments may arrive still percent-encoded from the URL.
 */
export function normalizeOnlineMenuSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return "";
  let decoded = trimmed;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
      decoded = decodeURIComponent(trimmed);
    }
  } catch {
    decoded = trimmed;
  }
  return decoded.trim().toLowerCase();
}
