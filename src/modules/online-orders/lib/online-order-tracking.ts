import crypto from "node:crypto";

/**
 * Tokenized public tracking link — HMAC over order id (no new DB column).
 * Format: `{orderId}.{signature}` where signature = HMAC-SHA256(base64url) of `ot1:{orderId}`.
 */

const PREFIX = "ot1";

function trackingSecret(): string {
  const dedicated = process.env.SweetFlow_COOKIE_SECRET;
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SweetFlow_COOKIE_SECRET is required in production");
  }
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!fallback) {
    throw new Error("Missing tracking signing secret");
  }
  return fallback;
}

function signOrderId(orderId: string): string {
  return crypto
    .createHmac("sha256", trackingSecret())
    .update(`${PREFIX}:${orderId}`)
    .digest("base64url");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createOnlineOrderTrackingToken(orderId: string): string {
  const id = orderId.trim();
  if (!UUID_RE.test(id)) {
    throw new Error("معرّف الطلب غير صالح");
  }
  return `${id}.${signOrderId(id)}`;
}

/** Returns order id when token is valid; otherwise null. */
export function verifyOnlineOrderTrackingToken(token: string | null | undefined): string | null {
  const raw = token?.trim() ?? "";
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const orderId = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!UUID_RE.test(orderId) || !signature) return null;

  const expected = signOrderId(orderId);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    return null;
  }
  return orderId;
}

export function buildOnlineOrderTrackingPath(orderId: string): string {
  return `/track/${encodeURIComponent(createOnlineOrderTrackingToken(orderId))}`;
}
