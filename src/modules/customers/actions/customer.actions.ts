"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  createCustomer,
  deleteCustomer,
  getCustomerProfile,
  getCustomerLedger,
  listCustomers,
  updateCustomer,
} from "@/modules/customers/services/customer.service";
import {
  getCustomerStatement,
  recordCustomerPayment,
} from "@/modules/customers/services/customer-account.service";
import type { PaymentMethod } from "@/lib/types";

export async function createCustomerAction(input: {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  const customer = await createCustomer({ ...input, userId: user.id });
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomerAction(
  id: string,
  input: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    credit_limit?: number;
    payment_terms?: string;
  }
) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  await updateCustomer(id, input, user.id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomerAction(id: string) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  await deleteCustomer(id, user.id);
  revalidatePath("/customers");
}

export async function getCustomersData(search?: string) {
  await requirePermissionOrRole("customer_manage", ["owner", "manager", "cashier"]);
  return { customers: await listCustomers(search) };
}

export async function getCustomerProfileData(id: string) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager", "cashier"]);
  const profile = await getCustomerProfile(id);
  if (!profile) return null;
  const canViewLedger =
    user.role === "owner" ||
    (await import("@/lib/repositories/permission.repository").then((m) =>
      m.hasPermission("customer_ledger_view")
    ));
  return {
    profile,
    ledger: await getCustomerLedger(id),
    statement: canViewLedger ? await getCustomerStatement(id) : null,
  };
}

export async function recordCustomerPaymentAction(input: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}) {
  const user = await requirePermissionOrRole("customer_payment_receive", [
    "owner",
    "manager",
    "cashier",
  ]);
  const storeId = await getValidatedActiveStoreId();
  await recordCustomerPayment({
    ...input,
    storeId,
    userId: user.id,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${input.customerId}`);
  revalidatePath("/pos");
}

export async function listOutstandingCustomersAction() {
  await requirePermissionOrRole("customer_payment_receive", [
    "owner",
    "manager",
    "cashier",
  ]);
  const { getOutstandingBalances } = await import(
    "@/modules/customers/services/customer-account.service"
  );
  return getOutstandingBalances();
}

export async function getCustomerAccountsReportData() {
  await requirePermissionOrRole("customer_ledger_view", ["owner", "manager"]);
  const { getOutstandingBalances, getAgingReport } = await import(
    "@/modules/customers/services/customer-account.service"
  );
  return {
    outstanding: await getOutstandingBalances(),
    aging: await getAgingReport(),
  };
}
