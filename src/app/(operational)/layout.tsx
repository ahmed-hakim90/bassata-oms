export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import {
  getEffectivePermissions,
  isRbacSeeded,
} from "@/lib/repositories/permission.repository";

export default async function OperationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let permissions;
  let rbacSeeded;

  try {
    user = await ensureTenantUser(await getCurrentUser());
    [permissions, rbacSeeded] = await Promise.all([
      getEffectivePermissions(user),
      isRbacSeeded(),
    ]);
  } catch (error) {
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
