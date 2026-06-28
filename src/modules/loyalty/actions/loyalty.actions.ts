"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  getLedger,
  getLoyaltyRule,
  getLoyaltyStats,
  redeemPoints,
  updateLoyaltyRule,
} from "@/modules/loyalty/services/loyalty.service";
import { listCustomers } from "@/modules/customers/services/customer.service";

export async function updateLoyaltyRuleAction(input: {
  pointsPerCurrency?: number;
  redemptionRate?: number;
  minimumRedeemPoints?: number;
  isActive?: boolean;
}) {
  await requireFeature("loyalty");
  const user = await requirePermissionOrRole("loyalty_manage", ["owner", "manager"]);
  const rule = await getLoyaltyRule();
  if (!rule) throw new Error("No loyalty rule");
  await updateLoyaltyRule(
    {
      points_per_currency: input.pointsPerCurrency,
      redemption_rate: input.redemptionRate,
      minimum_redeem_points: input.minimumRedeemPoints,
      is_active: input.isActive,
    },
    user.id
  );
  revalidatePath("/customers/loyalty");
}

export async function redeemPointsAction(input: {
  customerId: string;
  points: number;
  reason: string;
}) {
  await requireFeature("loyalty");
  const user = await requirePermissionOrRole("loyalty_manage", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  await redeemPoints({ ...input, userId: user.id, storeId });
  revalidatePath("/customers/loyalty");
  revalidatePath(`/customers/${input.customerId}`);
}

export async function getLoyaltyData() {
  await requireFeature("loyalty");
  await requirePermissionOrRole("loyalty_manage", ["owner", "manager"]);
  const ledger = await getLedger(20);
  const rule = await getLoyaltyRule();
  if (!rule) throw new Error("Loyalty rules not configured");
  return {
    rule,
    stats: await getLoyaltyStats(),
    ledger,
    customers: await listCustomers(),
  };
}
