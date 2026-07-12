"use server";

import { requirePermissionOrRole } from "@/lib/auth/guards";
import {
  quickCreateCustomer,
  searchCustomersForPOS,
} from "@/modules/pos/services/customer-attach.service";
import type { Customer } from "@/lib/types";

export async function searchCustomersAction(query: string): Promise<Customer[]> {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  return searchCustomersForPOS(query);
}

export async function quickCreateCustomerAction(input: {
  name: string;
  phone: string;
}): Promise<Customer> {
  const user = await requirePermissionOrRole("customer_manage", [
    "owner",
    "manager",
    "cashier",
  ]);
  return quickCreateCustomer({ ...input, userId: user.id });
}
