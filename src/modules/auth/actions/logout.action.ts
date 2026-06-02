"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_COOKIE, CASHIER_COOKIE } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { PLATFORM_SUPPORT_COOKIE } from "@/lib/platform/support-session";

export async function logoutAction() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(STORE_COOKIE);
  cookieStore.delete(CASHIER_COOKIE);
  cookieStore.delete(PLATFORM_SUPPORT_COOKIE);

  if (user) {
    const orgId = await getOrgId().catch(() => user.org_id);
    await writeAuditLog({
      orgId,
      userId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
    });
  }

  redirect("/login");
}
