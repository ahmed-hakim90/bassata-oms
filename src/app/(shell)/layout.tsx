export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { getActiveStoreId, getCurrentUser } from "@/lib/auth/session";
import { getPageAccessDenial } from "@/lib/auth/page-access";
import { requireStoreAccess } from "@/lib/auth/guards";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import * as storeRepo from "@/lib/repositories/store.repository";
import { redirect } from "next/navigation";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [featureFlags, allStores, cookieStoreId, permissions, posReadiness] = await Promise.all([
    getFeatureFlags(),
    storeRepo.listStores(),
    getActiveStoreId(),
    getEffectivePermissions(user),
    getPosReadiness(),
  ]);
  const stores =
    user.role === "owner" || user.role === "manager"
      ? allStores
      : allStores.filter((s) => user.store_ids.includes(s.id));

  let activeStoreId = cookieStoreId;
  if (!activeStoreId && stores.length > 0) {
    const defaultStore = stores[0]!;
    try {
      await requireStoreAccess(defaultStore.id);
      activeStoreId = defaultStore.id;
    } catch {
      activeStoreId = null;
    }
  }
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const denial = getPageAccessDenial(pathname, user.role, featureFlags, permissions);

  return (
    <AppShell
      userRole={user.role}
      userName={user.name}
      featureFlags={featureFlags}
      stores={stores}
      activeStoreId={activeStoreId}
      permissions={[...permissions]}
      posReadinessState={posReadiness.state}
    >
      {denial ? (
        <AccessDenied title={denial.title} description={denial.description} />
      ) : (
        children
      )}
    </AppShell>
  );
}
