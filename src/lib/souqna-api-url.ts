export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function resolveDefaultSouqnaApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return normalizeApiBaseUrl(fromEnv);
  return "";
}

export async function resolveSouqnaApiBaseUrlFromRequest(): Promise<string> {
  const fromEnv = resolveDefaultSouqnaApiBaseUrl();
  if (fromEnv) return fromEnv;

  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";

  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return normalizeApiBaseUrl(`${proto}://${host}`);
}

export function buildSouqnaApiEndpoints(apiBaseUrl: string) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  if (!base) {
    return {
      api_base_url: "",
      products_url: "",
      orders_url: "",
    };
  }
  return {
    api_base_url: base,
    products_url: `${base}/api/souqna/products`,
    orders_url: `${base}/api/souqna/orders`,
  };
}

export function isValidApiBaseUrl(url: string): boolean {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
