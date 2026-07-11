import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export const isOrganizationSuspended = cache(async (orgId: string): Promise<boolean> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return false;
  return data.status === "suspended";
});
