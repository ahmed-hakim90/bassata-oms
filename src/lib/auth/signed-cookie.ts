import crypto from "node:crypto";
import { resolveCookieSigningSecret } from "@/lib/auth/cookie-signing-secret";

const VERSION = "v1";

function secret() {
  return resolveCookieSigningSecret();
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
