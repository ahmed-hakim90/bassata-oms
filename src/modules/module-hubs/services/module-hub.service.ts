import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import type { NavAccessOptions } from "@/lib/auth/nav";
import { requireAuth } from "@/lib/auth/guards";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { isFoodServiceActivity } from "@/lib/business-activity-flags";
import {
  getBusinessActivitySettings,
  getFeatureFlags,
} from "@/modules/system/services/settings.service";
import { getFilteredModuleHub } from "@/modules/module-hubs/lib/filter-module-hub";
import type { ModuleHubId } from "@/modules/module-hubs/lib/module-hub-catalog";
import { loadHubAnalytics } from "@/modules/module-hubs/services/load-hub-analytics";

export async function loadModuleHubPage(hubId: ModuleHubId) {
  const user = await ensureTenantUser(await requireAuth());
  const [permissions, featureFlags, businessActivity, analytics] = await Promise.all([
    getEffectivePermissions(user),
    getFeatureFlags(),
    getBusinessActivitySettings(),
    loadHubAnalytics(hubId),
  ]);

  const options: NavAccessOptions = {
    enableWholesaleSales: businessActivity.enable_wholesale_sales,
    allowCashierWholesale: businessActivity.allow_cashier_wholesale,
    enableKitchenDisplay: isFoodServiceActivity(businessActivity.activity_type),
  };

  const hub = getFilteredModuleHub(
    hubId,
    user.role,
    permissions,
    featureFlags,
    options
  );

  return { ...hub, analytics };
}
