export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { getActiveStoreId, getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { getPageAccessDenial } from "@/lib/auth/page-access";
import { requireStoreAccess } from "@/lib/auth/guards";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import {
  getBusinessActivitySettings,
  getFeatureFlags,
} from "@/modules/system/services/settings.service";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import * as storeRepo from "@/lib/repositories/store.repository";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let featureFlags;
  let businessActivity;
  let allStores;
  let cookieStoreId;
  let permissions;
  let posReadiness;

  try {
    user = await ensureTenantUser(await getCurrentUser());
    [featureFlags, businessActivity, allStores, cookieStoreId, permissions, posReadiness] =
      await Promise.all([
        getFeatureFlags(),
        getBusinessActivitySettings(),
        storeRepo.listStores(),
        getActiveStoreId(),
        getEffectivePermissions(user),
        getPosReadiness(),
      ]);
  } catch (error) {
    redirectOnAuthFailure(error, "/");
  }

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
  const navAccess = {
    enableWholesaleSales: businessActivity.enable_wholesale_sales,
    allowCashierWholesale: businessActivity.allow_cashier_wholesale,
  };
  const denial = getPageAccessDenial(
    pathname,
    user.role,
    featureFlags,
    permissions,
    navAccess
  );

  return (
    <AppShell
      userRole={user.role}
      userName={user.name}
      featureFlags={featureFlags}
      enableWholesaleSales={businessActivity.enable_wholesale_sales}
      allowCashierWholesale={businessActivity.allow_cashier_wholesale}
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
