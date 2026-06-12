"use server";

import { requirePermissionOrRole } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import { getCustomerLoyaltyBalance } from "@/modules/loyalty/services/loyalty.service";

export async function getCustomerLoyaltyBalanceAction(
  customerId: string
): Promise<number> {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  if (!(await isFeatureEnabled("loyalty"))) return 0;
  return getCustomerLoyaltyBalance(customerId);
}
