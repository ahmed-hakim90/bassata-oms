import { createAdminClient } from "@/lib/supabase/admin";

export async function assertSouqnaRateLimit(prefix: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("assert_souqna_rate_limit", { p_prefix: prefix });
  if (error) {
    throw new Error(error.message);
  }
}
