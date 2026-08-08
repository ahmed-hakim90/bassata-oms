/**
 * HMAC secret for device / cashier / store cookies and online tracking tokens.
 *
 * Canonical env: `VELORA_COOKIE_SECRET`
 * Legacy alias (dual-read): `SweetFlow_COOKIE_SECRET`
 *
 * Prod fails closed (R9): never fall back to service_role / anon key.
 */
export function resolveCookieSigningSecret(): string {
  const dedicated =
    process.env.VELORA_COOKIE_SECRET?.trim() ||
    process.env.SweetFlow_COOKIE_SECRET?.trim();
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VELORA_COOKIE_SECRET is required in production (legacy SweetFlow_COOKIE_SECRET still accepted)"
    );
  }
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!fallback) {
    throw new Error("Missing cookie signing secret");
  }
  return fallback;
}

/** True when either canonical or legacy cookie secret env is set. */
export function hasCookieSigningSecretEnv(): boolean {
  return Boolean(
    process.env.VELORA_COOKIE_SECRET?.trim() ||
      process.env.SweetFlow_COOKIE_SECRET?.trim()
  );
}
