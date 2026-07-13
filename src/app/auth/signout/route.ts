import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  CASHIER_COOKIE,
  REGISTERED_DEVICE_COOKIE,
  STORE_COOKIE,
} from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";

const APP_COOKIES = [STORE_COOKIE, CASHIER_COOKIE, REGISTERED_DEVICE_COOKIE] as const;

/**
 * Clears Supabase + app session cookies, then redirects to login.
 * Must run in a Route Handler — Server Components cannot reliably write cookies
 * (createClient setAll is a no-op there), which caused login ↔ / redirect loops.
 */
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");
  const loginUrl = new URL("/login", request.url);
  if (reason === "provisioned" || reason === "suspended" || reason === "auth") {
    loginUrl.searchParams.set("error", reason);
  } else {
    loginUrl.searchParams.set("signedout", "1");
  }

  const response = NextResponse.redirect(loginUrl);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    const supabase = createServerClient<Database>(url, anonKey, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        },
      },
    });
    await supabase.auth.signOut();
  }

  for (const name of APP_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}
