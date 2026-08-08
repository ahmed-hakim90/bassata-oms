export const CUSTOM_DOMAIN_STATUSES = [
  "none",
  "pending_dns",
  "verifying",
  "active",
  "error",
] as const;

export type CustomDomainStatus = (typeof CUSTOM_DOMAIN_STATUSES)[number];

export const HOST_ORG_COOKIE = "sf_host_org";

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Normalize request host or operator input to a bare lowercase hostname. */
export function normalizeHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  // Strip scheme / path / port
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? "";
  value = value.split(":")[0] ?? "";
  value = value.replace(/\.$/, "");

  if (!value || value === "localhost") return value === "localhost" ? "localhost" : null;
  if (!HOSTNAME_RE.test(value) && value !== "localhost") return null;
  return value;
}

export function platformCanonicalHost(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) return null;
  try {
    return normalizeHostname(new URL(url).host);
  } catch {
    return normalizeHostname(url);
  }
}

export function reservedHostnames(): Set<string> {
  const reserved = new Set<string>();
  const canonical = platformCanonicalHost();
  if (canonical) reserved.add(canonical);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    const h = normalizeHostname(vercelProd);
    if (h) reserved.add(h);
  }

  const extra = process.env.PLATFORM_RESERVED_HOSTS?.split(",") ?? [];
  for (const part of extra) {
    const h = normalizeHostname(part);
    if (h) reserved.add(h);
  }

  reserved.add("localhost");
  return reserved;
}

export function isReservedHostname(host: string): boolean {
  const normalized = normalizeHostname(host);
  if (!normalized) return true;
  if (normalized.endsWith(".vercel.app")) return true;
  return reservedHostnames().has(normalized);
}

export function isValidCustomDomainHostname(host: string): boolean {
  const normalized = normalizeHostname(host);
  if (!normalized || normalized === "localhost") return false;
  if (isReservedHostname(normalized)) return false;
  return HOSTNAME_RE.test(normalized);
}
