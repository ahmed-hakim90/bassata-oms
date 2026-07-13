"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CASHIER_COOKIE,
  clearActiveStoreCookie,
  getCurrentUser,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";

export async function logoutAction() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  await clearActiveStoreCookie();
  cookieStore.delete(CASHIER_COOKIE);
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
