"use server";

import { revalidatePath } from "next/cache";
import {
  requireFeature,
  requirePermissionOrRole,
  getValidatedActiveStoreId,
} from "@/lib/auth/guards";
import {
  attachContainerToCertificate,
  createContainer,
  listContainersWithLines,
  receiveContainer,
  updateContainerStatus,
  type ContainerWithLines,
} from "@/modules/purchases/services/purchase-container.service";
import {
  addCertificateCost,
  closeCertificate,
  createCertificate,
  listCertificatesWithDetails,
  type CertificateWithDetails,
} from "@/modules/purchases/services/customs-certificate.service";
import type {
  CustomsCertificateCostType,
  PurchaseContainerStatus,
} from "@/modules/purchases/lib/import-constants";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";

export type ImportActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

async function runImportAction<T>(fn: () => Promise<T>): Promise<ImportActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

async function requireImportAccess() {
  await requireFeature("purchases");
  await requireFeature("purchase_imports");
  return requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
}

function revalidateImportPaths() {
  revalidatePath("/inventory/containers");
  revalidatePath("/inventory/customs-certificates");
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/purchases");
  revalidatePath("/purchasing");
}

export async function listContainersAction(options?: {
  purchaseOrderId?: string;
}): Promise<ImportActionResult<ContainerWithLines[]>> {
  return runImportAction(async () => {
    await requireImportAccess();
    const storeId = await getValidatedActiveStoreId();
    return listContainersWithLines({
      storeId,
      purchaseOrderId: options?.purchaseOrderId,
    });
  });
}

export async function createContainerAction(input: {
  purchaseOrderId: string;
  containerNumber: string;
  warehouseId?: string;
  notes?: string;
  lines: { sourceLineId: string; quantity: number }[];
}): Promise<ImportActionResult<ContainerWithLines>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const container = await createContainer({
      ...input,
      createdBy: user.id,
    });
    revalidateImportPaths();
    return container;
  });
}

export async function updateContainerStatusAction(input: {
  containerId: string;
  status: PurchaseContainerStatus;
}): Promise<ImportActionResult<ContainerWithLines>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const container = await updateContainerStatus({
      containerId: input.containerId,
      status: input.status,
      userId: user.id,
    });
    revalidateImportPaths();
    return container;
  });
}

export async function attachContainerCertificateAction(input: {
  containerId: string;
  certificateId: string | null;
}): Promise<ImportActionResult<ContainerWithLines>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const container = await attachContainerToCertificate({
      ...input,
      userId: user.id,
    });
    revalidateImportPaths();
    return container;
  });
}

export async function receiveContainerAction(input: {
  containerId: string;
  amountPaid?: number;
  paymentMethod?: "cash" | "card" | "wallet" | "other";
}): Promise<ImportActionResult<{ container: ContainerWithLines; purchase: PurchaseWithLines }>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const result = await receiveContainer({
      containerId: input.containerId,
      userId: user.id,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
    });
    revalidateImportPaths();
    return result;
  });
}

export async function listCertificatesAction(): Promise<
  ImportActionResult<CertificateWithDetails[]>
> {
  return runImportAction(async () => {
    await requireImportAccess();
    const storeId = await getValidatedActiveStoreId();
    return listCertificatesWithDetails({ storeId });
  });
}

export async function createCertificateAction(input: {
  certificateNumber: string;
  certificateDate?: string;
  notes?: string;
}): Promise<ImportActionResult<CertificateWithDetails>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const storeId = await getValidatedActiveStoreId();
    const cert = await createCertificate({
      storeId,
      certificateNumber: input.certificateNumber,
      certificateDate: input.certificateDate,
      notes: input.notes,
      createdBy: user.id,
    });
    revalidateImportPaths();
    return cert;
  });
}

export async function addCertificateCostAction(input: {
  certificateId: string;
  costType: CustomsCertificateCostType;
  amount: number;
  payeeSupplierId?: string | null;
  paymentMethod?: "cash" | "card" | "wallet" | "other" | null;
  notes?: string;
}): Promise<ImportActionResult<CertificateWithDetails>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const cert = await addCertificateCost({
      ...input,
      createdBy: user.id,
    });
    revalidateImportPaths();
    return cert;
  });
}

export async function closeCertificateAction(
  certificateId: string
): Promise<ImportActionResult<CertificateWithDetails>> {
  return runImportAction(async () => {
    const user = await requireImportAccess();
    const cert = await closeCertificate({
      certificateId,
      userId: user.id,
    });
    revalidateImportPaths();
    return cert;
  });
}
