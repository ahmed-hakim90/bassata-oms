export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import {
  getEffectivePermissions,
  isRbacSeeded,
} from "@/lib/repositories/permission.repository";

export default async function OperationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [permissions, rbacSeeded] = await Promise.all([
    getEffectivePermissions(user),
    isRbacSeeded(),
  ]);
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
