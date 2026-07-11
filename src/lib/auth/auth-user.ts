import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Single auth.getUser() per request for all server paths. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
});
