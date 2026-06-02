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
}> {
  await requireFeature("purchases");
  await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const org = await orgRepo.getOrganization();
  const summaries = await listSupplierSummaries(storeId);
  return {
    summaries,
    storeId,
    currency: org.currency,
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
}): Promise<SupplierActionResult<SupplierPayment>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requireRole(["owner", "manager"]);
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
    });
    revalidatePath("/inventory/suppliers");
    revalidatePath(`/inventory/suppliers/${input.supplierId}`);
    return payment;
  });
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
    return payment;
  });
}

export async function createSupplierFromSuppliersAction(input: {
  name: string;
  contact_info?: string;
}): Promise<SupplierActionResult<Supplier>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const supplier = await createSupplier(
      { name: input.name, contact_info: input.contact_info ?? "" },
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
}): Promise<SupplierActionResult<Supplier>> {
  return runSupplierAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const supplier = await updateSupplier(
      input.id,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contact_info !== undefined ? { contact_info: input.contact_info } : {}),
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
