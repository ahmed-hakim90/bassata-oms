"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole, requireRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
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
  voidCustomerPayment,
} from "@/modules/customers/services/customer-account.service";
import type { CustomerStatement, PaymentMethod } from "@/lib/types";

export async function createCustomerAction(input: {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  address?: string;
  tax_id?: string;
}) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  const customer = await createCustomer({ ...input, userId: user.id });
  revalidatePath("/customers");
  revalidatePath("/customers/directory");
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
    address?: string;
    tax_id?: string;
  }
) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  await updateCustomer(id, input, user.id);
  revalidatePath("/customers");
  revalidatePath("/customers/directory");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomerAction(id: string) {
  const user = await requirePermissionOrRole("customer_manage", ["owner", "manager"]);
  await deleteCustomer(id, user.id);
  revalidatePath("/customers");
  revalidatePath("/customers/directory");
}

export async function getCustomersData(search?: string): Promise<{
  customers: Awaited<ReturnType<typeof listCustomers>>;
  currency: string;
  glance: {
    collected30d: number;
    agingBuckets: import("@/modules/reports/lib/aging-buckets").AgingBuckets;
    partiesWithBalance: number;
  } | null;
}> {
  const user = await requirePermissionOrRole("customer_manage", [
    "owner",
    "manager",
    "cashier",
  ]);
  const customers = await listCustomers(search);
  const org = await import("@/lib/repositories/organization.repository").then((m) =>
    m.getOrganization()
  );

  const canGlance =
    user.role === "owner" ||
    user.role === "manager" ||
    (await import("@/lib/repositories/permission.repository").then((m) =>
      m.hasPermission("customer_ledger_view")
    ));

  if (!canGlance) {
    return { customers, currency: org.currency, glance: null };
  }

  const storeId = await getValidatedActiveStoreId();
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);

  const [{ sumPaymentsForStoreInRange }, { getCustomerAgingSide }] = await Promise.all([
    import("@/lib/repositories/customer-account.repository"),
    import("@/modules/reports/services/aging-report.service"),
  ]);

  const [collected30d, aging] = await Promise.all([
    sumPaymentsForStoreInRange(storeId, from.toISOString(), to.toISOString()),
    getCustomerAgingSide(),
  ]);

  return {
    customers,
    currency: org.currency,
    glance: {
      collected30d,
      agingBuckets: aging.buckets,
      partiesWithBalance: aging.rows.length,
    },
  };
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
  treasuryId?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requirePermissionOrRole("customer_payment_receive", [
      "owner",
      "manager",
      "cashier",
    ]);
    if (!(input.amount > 0) || !Number.isFinite(input.amount)) {
      return { success: false, error: "أدخل مبلغ تحصيل صحيح" };
    }
    const storeId = await getValidatedActiveStoreId();
    await recordCustomerPayment({
      ...input,
      storeId,
      userId: user.id,
    });
    revalidatePath("/customers");
    revalidatePath("/customers/directory");
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath("/treasury");
    // Avoid revalidatePath("/pos") — remounting POS mid-session freezes the screen.
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر تسجيل التحصيل",
    };
  }
}

export async function voidCustomerPaymentAction(
  paymentId: string,
  customerId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireRole(["owner", "manager"]);
    await voidCustomerPayment({ paymentId, userId: user.id });
    revalidatePath("/customers");
    revalidatePath("/customers/directory");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/treasury");
    revalidatePath("/accounting/journals");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر إلغاء التحصيل",
    };
  }
}

export async function listOutstandingCustomersAction() {
  try {
    await requirePermissionOrRole("customer_payment_receive", [
      "owner",
      "manager",
      "cashier",
    ]);
    const { getOutstandingBalances } = await import(
      "@/modules/customers/services/customer-account.service"
    );
    return getOutstandingBalances();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "تعذر تحميل العملاء المستحقين"
    );
  }
}

export async function getCustomerStatementAction(
  customerId: string,
  range?: { from?: string; to?: string }
): Promise<
  | { ok: true; data: CustomerStatement }
  | { ok: false; error: string }
> {
  try {
    await requirePermissionOrRole("customer_ledger_view", ["owner", "manager"]);
    const statement = await getCustomerStatement(customerId, range);
    if (!statement) return { ok: false, error: "العميل مش موجود" };
    return { ok: true, data: statement };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "تعذر تحميل كشف الحساب",
    };
  }
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
