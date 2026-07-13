import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/config";
import { authCookieOptions } from "@/lib/supabase/auth-cookie-options";
import type { Database } from "@/lib/supabase/database.types";

/** One Supabase server client per React request (dedupes auth + queries). */
export const createClient = cache(async () => {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignore; proxy refreshes cookies on the next request.
        }
      },
    },
  });
});
