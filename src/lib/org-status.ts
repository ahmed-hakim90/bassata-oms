import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fail closed: missing org or read errors deny access (treat as suspended).
 * Callers must not treat a transient DB error as "active".
 */
export const isOrganizationSuspended = cache(async (orgId: string): Promise<boolean> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return true;
  return data.status === "suspended";
});
