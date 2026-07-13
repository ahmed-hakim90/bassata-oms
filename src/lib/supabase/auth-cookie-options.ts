import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Persistent auth cookies (survive browser close).
 * Matches @supabase/ssr DEFAULT maxAge (400 days, browser / RFC limit).
 */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  // Must stay non-httpOnly so createBrowserClient can refresh/read the session.
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
};
