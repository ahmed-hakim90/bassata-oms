import { createAdminClient } from "@/lib/supabase/admin";

export async function isOrganizationSuspended(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return false;
  return data.status === "suspended";
}
