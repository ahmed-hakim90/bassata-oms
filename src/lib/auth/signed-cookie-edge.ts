const VERSION = "v1";

/** Prod fails closed (R9): never fall back to service_role / anon key. */
function cookieSecret(): string {
  const dedicated = process.env.SweetFlow_COOKIE_SECRET;
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SweetFlow_COOKIE_SECRET is required in production");
  }
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!fallback) {
    throw new Error("Missing cookie signing secret");
  }
  return fallback;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Base64Url(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Edge-safe signed cookie reader for middleware (Web Crypto). */
export async function readSignedCookieValueEdge<T extends Record<string, unknown>>(
  value: string | undefined
): Promise<T | null> {
  if (!value) return null;
  const [version, payload, signature] = value.split(".");
  if (version !== VERSION || !payload || !signature) return null;

  const expected = await hmacSha256Base64Url(`${version}.${payload}`, cookieSecret());
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as T & { exp?: number };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
