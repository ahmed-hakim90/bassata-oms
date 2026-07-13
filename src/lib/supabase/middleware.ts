import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/supabase/auth-cookie-options";
import type { Database } from "@/lib/supabase/database.types";

export type SessionUpdateResult = {
  response: NextResponse;
  /** True when a valid (or refreshed) auth session cookie is present. */
  hasSession: boolean;
};

/**
 * Refresh auth cookies on the edge and return whether the request has a session.
 * Uses getClaims() so expired access tokens are refreshed and written back via setAll.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdateResult> {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response: supabaseResponse, hasSession: false };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        );
      },
    },
  });

  // Triggers refresh when access token is expired; cookies are written in setAll.
  const { data } = await supabase.auth.getClaims();
  return {
    response: supabaseResponse,
    hasSession: Boolean(data?.claims),
  };
}
