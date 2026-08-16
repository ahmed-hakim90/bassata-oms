import { headers } from "next/headers";
import { AccessDenied } from "@/components/Velora/access-denied";
import type { NavAccessOptions } from "@/lib/auth/nav";
import { getPageAccessDenial } from "@/lib/auth/page-access";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";

export async function PageAccessGate({
  children,
  role,
  featureFlags,
  permissions,
  navAccess,
}: {
  children: React.ReactNode;
  role: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  permissions: Set<PermissionKey>;
  navAccess?: NavAccessOptions;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const denial = getPageAccessDenial(
    pathname,
    role,
    featureFlags,
    permissions,
    navAccess
  );

  if (denial) {
    return <AccessDenied title={denial.title} description={denial.description} />;
  }

  return children;
}
