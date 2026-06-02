"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  addTransferLine,
  createDraftTransfer,
  deleteDraftTransfer,
  getTransfer,
  listTransfers,
  receiveTransfer,
  removeTransferLine,
  sendTransfer,
  updateDraftTransfer,
  updateTransferLineQuantity,
  voidTransfer,
} from "@/modules/transfers/services/transfer.service";
import type { TransferOrder, TransferOrderLine } from "@/lib/types";
import type { TransferWithLines } from "@/modules/transfers/services/transfer.service";

export type TransferActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

async function runTransferAction<T>(fn: () => Promise<T>): Promise<TransferActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function getTransferDetailAction(
  transferId: string
): Promise<TransferActionResult<TransferWithLines>> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    const transfer = await getTransfer(transferId);
    if (!transfer) throw new Error("Transfer not found");
    return transfer;
  });
}

export async function createTransferAction(input: {
  fromStoreId: string;
  toStoreId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
}): Promise<TransferActionResult<TransferOrder>> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    const user = await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    const transfer = await createDraftTransfer({ ...input, createdBy: user.id });
    revalidatePath("/inventory/transfers");
    return transfer;
  });
}

export async function addTransferLineAction(input: {
  transferId: string;
  productId: string;
  quantity: number;
}): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    await addTransferLine(input);
    revalidatePath("/inventory/transfers");
  });
}

export async function removeTransferLineAction(lineId: string): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    await removeTransferLine(lineId);
    revalidatePath("/inventory/transfers");
  });
}

export async function updateDraftTransferAction(input: {
  transferId: string;
  fromStoreId?: string;
  toStoreId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
}): Promise<TransferActionResult<TransferOrder>> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    const { transferId, ...stores } = input;
    const transfer = await updateDraftTransfer(transferId, stores);
    revalidatePath("/inventory/transfers");
    return transfer;
  });
}

export async function updateTransferLineAction(input: {
  lineId: string;
  quantity: number;
}): Promise<TransferActionResult<TransferOrderLine>> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    const line = await updateTransferLineQuantity(input.lineId, input.quantity);
    revalidatePath("/inventory/transfers");
    return line;
  });
}

export async function deleteDraftTransferAction(
  transferId: string
): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    const user = await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    await deleteDraftTransfer(transferId, user.id);
    revalidatePath("/inventory/transfers");
  });
}

export async function voidTransferAction(transferId: string): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    const user = await requirePermissionOrRole("transfer_manage", ["owner", "manager"]);
    await voidTransfer(transferId, user.id);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
  });
}

export async function sendTransferAction(
  transferId: string
): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    const user = await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    await sendTransfer(transferId, user.id);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
  });
}

export async function receiveTransferAction(
  transferId: string
): Promise<TransferActionResult> {
  return runTransferAction(async () => {
    await requireFeature("transfers");
    const user = await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
    await receiveTransfer(transferId, user.id);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
  });
}

export async function getTransfersData() {
  await requireFeature("transfers");
  await requirePermissionOrRole("transfer_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  return {
    transfers: await listTransfers(storeId),
    stores: await storeRepo.listStores(),
    warehouses: await warehouseRepo.listWarehouses(),
    products: await catalogRepo.listProducts({ activeOnly: true }),
    storeId,
  };
}
