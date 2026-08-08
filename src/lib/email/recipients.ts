import { createAdminClient } from "@/lib/supabase/admin";

/** Active owner emails for an org (admin client — not RLS-session dependent). */
export async function listOwnerEmails(orgId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("email")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .eq("is_active", true);

  if (error) {
    console.error("[email] listOwnerEmails failed", error.message);
    return [];
  }

  const emails = new Set<string>();
  for (const row of data ?? []) {
    const email = row.email?.trim().toLowerCase();
    if (email && email.includes("@")) emails.add(email);
  }
  return [...emails];
}
