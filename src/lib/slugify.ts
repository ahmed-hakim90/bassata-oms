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
