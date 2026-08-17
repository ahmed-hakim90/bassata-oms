"use server";

import { revalidatePath } from "next/cache";
import {
  requireFeature,
  requirePermissionOrRole,
  requireRole,
  getValidatedActiveStoreId,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import {
  createSupplier,
  updateSupplier,
} from "@/modules/purchases/services/supplier.service";
import {
  createSupplierPayment,
  getSupplierStatement,
  listSupplierSummaries,
  voidSupplierPayment,
} from "@/modules/suppliers/services/supplier.service";
import type { PaymentMethod } from "@/lib/types";
import type { Supplier, SupplierListSummary, SupplierPayment, SupplierStatement } from "@/lib/types";

export type SupplierActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

async function runSupplierAction<T>(fn: () => Promise<T>): Promise<SupplierActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function getSuppliersPageDataAction(): Promise<{
  summaries: SupplierListSummary[];
  storeId: string;
  currency: string;
  canManagePayments: boolean;
  glance: {
    paid30d: number;
    agingBuckets: import("@/modules/reports/lib/aging-buckets").AgingBuckets;
    partiesWithBalance: number;
  };
}> {
  await requireFeature("purchases");
  const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const org = await orgRepo.getOrganization();

  const [{ listPaymentsForStore }, { getSupplierAgingSide }] = await Promise.all([
    import("@/lib/repositories/supplier-payment.repository"),
    import("@/modules/reports/services/aging-report.service"),
  ]);

  const [summaries, payments, aging] = await Promise.all([
    listSupplierSummaries(storeId),
    listPaymentsForStore(storeId),
    getSupplierAgingSide(storeId),
  ]);

  const fromMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const paid30d = payments
    .filter((p) => !p.voided_at && new Date(p.paid_at).getTime() >= fromMs)
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    summaries,
    storeId,
    currency: org.currency,
    canManagePayments: user.role === "owner" || user.role === "manager",
    glance: {
      paid30d,
      agingBuckets: aging.buckets,
      partiesWithBalance: aging.rows.length,
    },
  };
}

export async function getSupplierDetailDataAction(
  supplierId: string,
  options?: { from?: string; to?: string }
): Promise<{
  statement: SupplierStatement;
  currency: string;
  canManagePayments: boolean;
  canEditSupplier: boolean;
  storeId: string;
} | null> {
  await requireFeature("purchases");
  const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const statement = await getSupplierStatement(supplierId, {
    storeId,
    from: options?.from,
    to: options?.to,
  });
  if (!statement) return null;
  const org = await orgRepo.getOrganization();
  const canManagePayments = user.role === "owner" || user.role === "manager";
  const canEditSupplier =
    user.role === "owner" ||
    user.role === "manager" ||
    user.role === "inventory";
  return {
    statement,
    currency: org.currency,
    canManagePayments,
    canEditSupplier,
    storeId,
  };
}

export async function getSupplierStatementAction(
  supplierId: string,
  options?: { from?: string; to?: string }
): Promise<SupplierActionResult<SupplierStatement>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    const statement = await getSupplierStatement(supplierId, {
      storeId,
      from: options?.from,
      to: options?.to,
    });
    if (!statement) throw new Error("Supplier not found");
    return statement;
  });
}

export async function createSupplierPaymentAction(input: {
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt?: string;
  treasuryId?: string | null;
}): Promise<SupplierActionResult<SupplierPayment>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    // Owner/manager always; cashier only with supplier_payment_record grant.
    const user = await requirePermissionOrRole("supplier_payment_record", [
      "owner",
      "manager",
    ]);
    const storeId = await getValidatedActiveStoreId();
    const payment = await createSupplierPayment({
      storeId,
      supplierId: input.supplierId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      notes: input.notes,
      paidAt: input.paidAt,
      createdBy: user.id,
      treasuryId: input.treasuryId,
    });
    revalidatePath("/inventory/suppliers");
    revalidatePath(`/inventory/suppliers/${input.supplierId}`);
    revalidatePath("/treasury");
    return payment;
  });
}

export async function listSuppliersForPosPaymentAction(): Promise<
  Pick<SupplierListSummary, "id" | "name" | "balanceDue">[]
> {
  await requireFeature("purchases");
  await requirePermissionOrRole("supplier_payment_record", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  const summaries = await listSupplierSummaries(storeId);
  return summaries
    .map((s) => ({ id: s.id, name: s.name, balanceDue: s.balanceDue }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export async function voidSupplierPaymentAction(
  paymentId: string,
  supplierId: string
): Promise<SupplierActionResult<SupplierPayment>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requireRole(["owner", "manager"]);
    const payment = await voidSupplierPayment(paymentId, user.id);
    revalidatePath("/inventory/suppliers");
    revalidatePath(`/inventory/suppliers/${supplierId}`);
    revalidatePath("/treasury");
    return payment;
  });
}

export async function createSupplierFromSuppliersAction(input: {
  name: string;
  contact_info?: string;
  opening_balance?: number;
  address?: string;
  tax_id?: string;
}): Promise<SupplierActionResult<Supplier>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const opening = input.opening_balance ?? 0;
    if (!Number.isFinite(opening) || opening < 0) {
      throw new Error("رصيد مستحق سابق لازم يكون صفر أو أكبر");
    }
    const supplier = await createSupplier(
      {
        name: input.name,
        contact_info: input.contact_info ?? "",
        opening_balance: opening,
        address: input.address?.trim() ?? "",
        tax_id: input.tax_id?.trim() ?? "",
      },
      user.id
    );
    revalidatePath("/inventory/suppliers");
    revalidatePath("/inventory/purchases");
    return supplier;
  });
}

export async function updateSupplierAction(input: {
  id: string;
  name?: string;
  contact_info?: string;
  opening_balance?: number;
  address?: string;
  tax_id?: string;
}): Promise<SupplierActionResult<Supplier>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    if (input.opening_balance !== undefined) {
      if (!Number.isFinite(input.opening_balance) || input.opening_balance < 0) {
        throw new Error("رصيد مستحق سابق لازم يكون صفر أو أكبر");
      }
    }
    const supplier = await updateSupplier(
      input.id,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contact_info !== undefined ? { contact_info: input.contact_info } : {}),
        ...(input.opening_balance !== undefined
          ? { opening_balance: input.opening_balance }
          : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        ...(input.tax_id !== undefined ? { tax_id: input.tax_id.trim() } : {}),
      },
      user.id
    );
    if (!supplier) throw new Error("Supplier not found");
    revalidatePath("/inventory/suppliers");
    revalidatePath(`/inventory/suppliers/${input.id}`);
    revalidatePath("/inventory/purchases");
    return supplier;
  });
}
