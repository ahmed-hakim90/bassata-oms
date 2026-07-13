import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];

function parseBootstrapEmails(): Set<string> {
  const raw = process.env.PLATFORM_BOOTSTRAP_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isBootstrapPlatformEmail(email: string): boolean {
  return parseBootstrapEmails().has(email.trim().toLowerCase());
}

/** Resolve active platform admin for the current auth session (service_role). Bootstraps from env emails. */
export const resolvePlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("platform_admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`platform_admins lookup failed: ${existingError.message}`);
  }

  if (existing) {
    if (!existing.is_active) return null;
    if (existing.auth_user_id !== user.id) {
      const { data: linked, error: linkError } = await admin
        .from("platform_admins")
        .update({
          auth_user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (linkError) throw new Error(`platform_admins link failed: ${linkError.message}`);
      return linked;
    }
    return existing;
  }

  if (!isBootstrapPlatformEmail(email)) return null;

  const metaName = user.user_metadata?.full_name;
  const displayName =
    typeof metaName === "string" && metaName.trim()
      ? metaName.trim()
      : email.split("@")[0] || "Platform Admin";

  const { data: created, error: createError } = await admin
    .from("platform_admins")
    .upsert(
      {
        email,
        auth_user_id: user.id,
        name: displayName,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();

  if (createError) {
    throw new Error(`platform_admins bootstrap failed: ${createError.message}`);
  }
  return created;
});

/** True when email may access platform (row or bootstrap list). Does not require session. */
export async function isPlatformAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isBootstrapPlatformEmail(normalized)) return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("id")
    .eq("email", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`platform_admins email check failed: ${error.message}`);
  return Boolean(data);
}
