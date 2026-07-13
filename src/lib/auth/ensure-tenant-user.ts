import { redirect } from "next/navigation";
import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import type { AppUser } from "@/lib/types";

/**
 * When auth JWT exists but there is no tenant `users` row (or org is suspended),
 * send platform admins to the control plane; otherwise clear the session via Route Handler.
 */
export async function ensureTenantUser(user: AppUser | null): Promise<AppUser> {
  if (user) return user;
  if (await resolvePlatformAdmin()) redirect("/platform");
  redirect("/auth/signout?reason=provisioned");
}
