export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageAccessGate } from "@/components/layout/page-access-gate";
import { PageLoadingSkeleton } from "@/components/Velora/page-loading-skeleton";
import { getActiveStoreId, getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { requireStoreAccess } from "@/lib/auth/guards";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import {
  getBusinessActivitySettings,
  getFeatureFlags,
} from "@/modules/system/services/settings.service";
import { isFoodServiceActivity } from "@/lib/business-activity-flags";
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
    const { assertUserMatchesHostOrg } = await import("@/lib/tenancy/host-org-session");
    await assertUserMatchesHostOrg(user.org_id);
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
    const { AuthError } = await import("@/lib/auth/auth-error");
    if (error instanceof AuthError && error.message.includes("دومين")) {
      const { redirect } = await import("next/navigation");
      redirect("/domain-unavailable?reason=tenant");
    }
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
  const enableKitchenDisplay = isFoodServiceActivity(businessActivity.activity_type);
  const navAccess = {
    enableWholesaleSales: businessActivity.enable_wholesale_sales,
    allowCashierWholesale: businessActivity.allow_cashier_wholesale,
    enableKitchenDisplay,
  };

  return (
    <AppShell
      userRole={user.role}
      userName={user.name}
      featureFlags={featureFlags}
      enableWholesaleSales={businessActivity.enable_wholesale_sales}
      allowCashierWholesale={businessActivity.allow_cashier_wholesale}
      enableKitchenDisplay={enableKitchenDisplay}
      stores={stores}
      activeStoreId={activeStoreId}
      permissions={[...permissions]}
      posReadinessState={posReadiness.state}
    >
      <Suspense fallback={<PageLoadingSkeleton />}>
        <PageAccessGate
          role={user.role}
          featureFlags={featureFlags}
          permissions={permissions}
          navAccess={navAccess}
        >
          {children}
        </PageAccessGate>
      </Suspense>
    </AppShell>
  );
}
