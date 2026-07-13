import crypto from "node:crypto";

const VERSION = "v1";

/** Prod fails closed (R9): never fall back to service_role / anon key. */
function secret() {
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

function signPayload(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSignedCookieValue(data: Record<string, unknown>, maxAgeSeconds: number) {
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    })
  ).toString("base64url");
  return `${VERSION}.${payload}.${signPayload(`${VERSION}.${payload}`)}`;
}

export function readSignedCookieValue<T extends Record<string, unknown>>(
  value: string | undefined
): T | null {
  if (!value) return null;
  const [version, payload, signature] = value.split(".");
  if (version !== VERSION || !payload || !signature) return null;
  const expected = signPayload(`${version}.${payload}`);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & {
      exp?: number;
    };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
