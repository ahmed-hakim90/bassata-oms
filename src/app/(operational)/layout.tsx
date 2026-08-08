export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { AccessDenied } from "@/components/Velora/access-denied";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import {
  getEffectivePermissions,
  isRbacSeeded,
} from "@/lib/repositories/permission.repository";
import { isSlugPosPath } from "@/lib/tenancy/pos-store-slug";

export default async function OperationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPublicPosEntry =
    pathname === "/pos" || pathname.startsWith("/pos/") || isSlugPosPath(pathname);

  const rawUser = await getCurrentUser();
  if (!rawUser) {
    if (isPublicPosEntry) {
      return <>{children}</>;
    }
    const { redirect } = await import("next/navigation");
    redirect(`/login?from=${encodeURIComponent(pathname || "/pos")}`);
  }

  let user;
  let permissions;
  let rbacSeeded;

  try {
    user = await ensureTenantUser(rawUser);
    const { assertUserMatchesHostOrg } = await import("@/lib/tenancy/host-org-session");
    await assertUserMatchesHostOrg(user.org_id);
    [permissions, rbacSeeded] = await Promise.all([
      getEffectivePermissions(user),
      isRbacSeeded(),
    ]);
  } catch (error) {
    const { AuthError } = await import("@/lib/auth/auth-error");
    if (error instanceof AuthError && error.message.includes("دومين")) {
      const { redirect } = await import("next/navigation");
      redirect("/domain-unavailable?reason=tenant");
    }
    redirectOnAuthFailure(error, "/pos");
  }

  const canUsePos =
    user.role === "owner" ||
    permissions.has("pos_access") ||
    (!rbacSeeded && (user.role === "manager" || user.role === "cashier"));

  if (user.role === "inventory" || !canUsePos) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <AccessDenied
          title="نقطة البيع غير متاحة"
          description="دورك لا يسمح باستخدام الكاشير. استخدم لوحة التحكم والموديولات المسموحة من المنيو."
        />
      </div>
    );
  }
  return <>{children}</>;
}
