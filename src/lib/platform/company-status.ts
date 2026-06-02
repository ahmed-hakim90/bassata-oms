import { createAdminClient } from "@/lib/supabase/admin";

export async function getOrganizationStatus(orgId: string): Promise<"active" | "suspended"> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();

  // Backward compatibility: older schemas do not have organizations.status yet.
  if (error) {
    if (error.code === "42703" || error.message.includes("organizations.status")) {
      return "active";
    }
    throw new Error(error.message);
  }
  return (data?.status ?? "active") as "active" | "suspended";
}

export async function isOrganizationSuspended(orgId: string): Promise<boolean> {
  return (await getOrganizationStatus(orgId)) === "suspended";
}
