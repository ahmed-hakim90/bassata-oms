"use server";

import { requirePermissionOrRole } from "@/lib/auth/guards";
import {
  quickCreateCustomer,
  searchCustomersForPOS,
} from "@/modules/pos/services/customer-attach.service";
import { getCustomerLoyaltyBalances } from "@/modules/loyalty/services/loyalty.service";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import type { Customer } from "@/lib/types";

export type PosCustomerSearchResult = Customer & {
  loyalty_balance: number | null;
};

export async function searchCustomersAction(
  query: string
): Promise<PosCustomerSearchResult[]> {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const customers = await searchCustomersForPOS(query);
  const loyaltyOn = await isFeatureEnabled("loyalty");
  if (!loyaltyOn || customers.length === 0) {
    return customers.map((c) => ({ ...c, loyalty_balance: null }));
  }
  const balances = await getCustomerLoyaltyBalances(customers.map((c) => c.id));
  return customers.map((c) => ({
    ...c,
    loyalty_balance: balances.get(c.id) ?? 0,
  }));
}

export async function quickCreateCustomerAction(input: {
  name: string;
  phone: string;
}): Promise<PosCustomerSearchResult> {
  const user = await requirePermissionOrRole("customer_manage", [
    "owner",
    "manager",
    "cashier",
  ]);
  try {
    const created = await quickCreateCustomer({
      name: input.name.trim(),
      phone: input.phone.trim(),
      userId: user.id,
    });
    return { ...created, loyalty_balance: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Phone number already registered")) {
      throw new Error("رقم الهاتف مسجل من قبل");
    }
    throw error instanceof Error ? error : new Error("فشل إضافة العميل");
  }
}
