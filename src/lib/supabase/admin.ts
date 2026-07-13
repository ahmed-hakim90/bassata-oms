import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * service_role client — bypasses RLS. Allowed only for:
 * onboarding bootstrap, platform control plane, public menu/order (explicit org/store filters),
 * auth user provisioning, and permanent user delete inside an already-authorized org action.
 * Inventory + review checklist: docs/MIGRATION_AUDIT.md § S06 service_role inventory.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
