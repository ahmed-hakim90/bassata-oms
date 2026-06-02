import * as transferRepo from "@/lib/repositories/transfer.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { TransferOrder, TransferOrderLine } from "@/lib/types";

export interface TransferWithLines extends TransferOrder {
  lines: TransferOrderLine[];
  fromStoreName: string;
  toStoreName: string;
  fromWarehouseName: string;
  toWarehouseName: string;
}

async function enrichTransfer(transfer: TransferOrder): Promise<TransferWithLines> {
  const [stores, warehouses] = await Promise.all([
    storeRepo.listStores(),
    warehouseRepo.listWarehouses(),
  ]);
  const from = stores.find((s) => s.id === transfer.from_store_id);
  const to = stores.find((s) => s.id === transfer.to_store_id);
  const fromWarehouse = warehouses.find((w) => w.id === transfer.from_warehouse_id);
  const toWarehouse = warehouses.find((w) => w.id === transfer.to_warehouse_id);
  const lines = await transferRepo.getTransferLines(transfer.id);
  return {
    ...transfer,
    lines,
    fromStoreName: from?.name ?? "Unknown",
    toStoreName: to?.name ?? "Unknown",
    fromWarehouseName: fromWarehouse?.name ?? "Unknown warehouse",
    toWarehouseName: toWarehouse?.name ?? "Unknown warehouse",
  };
}

export async function listTransfers(storeId?: string): Promise<TransferWithLines[]> {
  const transfers = await transferRepo.listTransfers();
  const filtered = transfers.filter(
    (t) =>
      !storeId || t.from_store_id === storeId || t.to_store_id === storeId
  );
  return Promise.all(filtered.map(enrichTransfer));
}

export async function getTransfer(id: string): Promise<TransferWithLines | null> {
  const transfer = await transferRepo.getTransfer(id);
  if (!transfer) return null;
  return enrichTransfer(transfer);
}

export async function createDraftTransfer(input: {
  fromStoreId: string;
  toStoreId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  createdBy: string;
}): Promise<TransferOrder> {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Source and destination warehouses must differ");
  }
  await assertPeriodOpen(input.fromStoreId);
  const transfer = await transferRepo.insertTransfer(
    {
      from_store_id: input.fromStoreId,
      to_store_id: input.toStoreId,
      from_warehouse_id: input.fromWarehouseId,
      to_warehouse_id: input.toWarehouseId,
      status: "draft",
      sent_at: null,
      received_at: null,
      created_by: input.createdBy,
    },
    []
  );
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.fromStoreId,
    userId: input.createdBy,
    action: "transfer.created",
    entityType: "transfer_order",
    entityId: transfer.id,
  });
  return transfer;
}

export async function addTransferLine(input: {
  transferId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  batchId?: string | null;
  batchNumber?: string | null;
}): Promise<TransferOrderLine> {
  const transfer = await transferRepo.getTransfer(input.transferId);
  if (!transfer || transfer.status !== "draft") throw new Error("Transfer not editable");

  const lines = await transferRepo.getTransferLines(input.transferId);
  const existing = lines.find(
    (l) =>
      l.product_id === input.productId &&
      l.variant_id === (input.variantId ?? null)
  );

  if (existing) {
    return (
      (await transferRepo.updateTransferLine(existing.id, {
        quantity_sent: existing.quantity_sent + input.quantity,
        batch_id: input.batchId ?? existing.batch_id ?? null,
        batch_number: input.batchNumber ?? existing.batch_number ?? null,
      })) ?? existing
    );
  }

  return transferRepo.addTransferLine({
    transfer_id: input.transferId,
    product_id: input.productId,
    variant_id: input.variantId ?? null,
    quantity_sent: input.quantity,
    quantity_received: 0,
    batch_id: input.batchId ?? null,
    batch_number: input.batchNumber ?? null,
  });
}

export async function sendTransfer(transferId: string, userId: string): Promise<TransferOrder> {
  const transfer = await transferRepo.getTransfer(transferId);
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "draft") throw new Error("Transfer already sent");
  await assertPeriodOpen(transfer.from_store_id);

  const lines = await transferRepo.getTransferLines(transferId);
  if (lines.length === 0) throw new Error("Add at least one line");

  for (const line of lines) {
    await adjustStock({
      storeId: transfer.from_store_id,
      warehouseId: transfer.from_warehouse_id,
      productId: line.product_id,
      variantId: line.variant_id,
      quantityDelta: -line.quantity_sent,
      movementType: "transfer_out",
      referenceType: "transfer_order",
      referenceId: transferId,
      createdBy: userId,
      batch: {
        batchNumber: line.batch_number ?? null,
        sourceType: "transfer",
        sourceDocumentId: transferId,
      },
    });
  }

  const updated = await transferRepo.updateTransfer(transferId, {
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("Failed to send transfer");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: transfer.from_store_id,
    userId,
    action: "transfer.sent",
    entityType: "transfer_order",
    entityId: transferId,
  });
  return updated;
}

export async function receiveTransfer(
  transferId: string,
  userId: string
): Promise<TransferOrder> {
  const transfer = await transferRepo.getTransfer(transferId);
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "sent") throw new Error("Transfer must be sent first");
  await assertPeriodOpen(transfer.to_store_id);

  const lines = await transferRepo.getTransferLines(transferId);
  for (const line of lines) {
    await transferRepo.updateTransferLine(line.id, {
      quantity_received: line.quantity_sent,
    });
    await adjustStock({
      storeId: transfer.to_store_id,
      warehouseId: transfer.to_warehouse_id,
      productId: line.product_id,
      variantId: line.variant_id,
      quantityDelta: line.quantity_sent,
      movementType: "transfer_in",
      referenceType: "transfer_order",
      referenceId: transferId,
      createdBy: userId,
      batch: {
        batchNumber: line.batch_number ?? null,
        sourceType: "transfer",
        sourceDocumentId: transferId,
      },
    });
  }

  const updated = await transferRepo.updateTransfer(transferId, {
    status: "received",
    received_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("Failed to receive transfer");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: transfer.to_store_id,
    userId,
    action: "transfer.received",
    entityType: "transfer_order",
    entityId: transferId,
  });
  return updated;
}

export async function removeTransferLine(lineId: string): Promise<void> {
  const line = await transferRepo.getTransferLine(lineId);
  if (!line) return;
  const transfer = await transferRepo.getTransfer(line.transfer_id);
  if (!transfer || transfer.status !== "draft") {
    throw new Error("Transfer not editable");
  }
  await transferRepo.deleteTransferLine(lineId);
}

export async function updateTransferLineQuantity(
  lineId: string,
  quantity: number,
  batchNumber?: string | null
): Promise<TransferOrderLine> {
  if (quantity <= 0) throw new Error("Invalid quantity");
  const line = await transferRepo.getTransferLine(lineId);
  if (!line) throw new Error("Line not found");
  const transfer = await transferRepo.getTransfer(line.transfer_id);
  if (!transfer || transfer.status !== "draft") {
    throw new Error("Transfer not editable");
  }
  const updated = await transferRepo.updateTransferLine(lineId, {
    quantity_sent: quantity,
    batch_number: batchNumber ?? line.batch_number ?? null,
  });
  if (!updated) throw new Error("Failed to update line");
  return updated;
}

export async function updateDraftTransfer(
  transferId: string,
  input: {
    fromStoreId?: string;
    toStoreId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
  }
): Promise<TransferOrder> {
  const transfer = await transferRepo.getTransfer(transferId);
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "draft") throw new Error("Transfer not editable");

  const fromStoreId = input.fromStoreId ?? transfer.from_store_id;
  const toStoreId = input.toStoreId ?? transfer.to_store_id;
  const fromWarehouseId = input.fromWarehouseId ?? transfer.from_warehouse_id;
  const toWarehouseId = input.toWarehouseId ?? transfer.to_warehouse_id;
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Source and destination warehouses must differ");
  }

  await assertPeriodOpen(fromStoreId);

  const updated = await transferRepo.updateTransfer(transferId, {
    from_store_id: fromStoreId,
    to_store_id: toStoreId,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
  });
  if (!updated) throw new Error("Failed to update transfer");
  return updated;
}

export async function deleteDraftTransfer(transferId: string, userId: string): Promise<void> {
  const transfer = await transferRepo.getTransfer(transferId);
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "draft") throw new Error("Only draft transfers can be deleted");
  await transferRepo.deleteTransferLinesForTransfer(transferId);
  await transferRepo.deleteTransfer(transferId);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: transfer.from_store_id,
    userId,
    action: "transfer.deleted",
    entityType: "transfer_order",
    entityId: transferId,
  });
}

export async function voidTransfer(transferId: string, userId: string): Promise<TransferOrder> {
  const transfer = await transferRepo.getTransfer(transferId);
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status === "draft") {
    throw new Error("Delete draft transfers instead of voiding");
  }
  if (transfer.status === "cancelled") throw new Error("Transfer already cancelled");

  const lines = await transferRepo.getTransferLines(transferId);

  if (transfer.status === "sent") {
    await assertPeriodOpen(transfer.from_store_id);
    for (const line of lines) {
      await adjustStock({
        storeId: transfer.from_store_id,
        warehouseId: transfer.from_warehouse_id,
        productId: line.product_id,
        variantId: line.variant_id,
        quantityDelta: line.quantity_sent,
        movementType: "transfer_out",
        referenceType: "transfer_order",
        referenceId: transferId,
        createdBy: userId,
        batch: {
          batchNumber: line.batch_number ?? null,
          sourceType: "transfer",
          sourceDocumentId: transferId,
        },
      });
    }
  } else if (transfer.status === "received") {
    await assertPeriodOpen(transfer.to_store_id);
    await assertPeriodOpen(transfer.from_store_id);
    for (const line of lines) {
      await adjustStock({
        storeId: transfer.to_store_id,
        warehouseId: transfer.to_warehouse_id,
        productId: line.product_id,
        variantId: line.variant_id,
        quantityDelta: -line.quantity_sent,
        movementType: "transfer_in",
        referenceType: "transfer_order",
        referenceId: transferId,
        createdBy: userId,
        batch: {
          batchNumber: line.batch_number ?? null,
          sourceType: "transfer",
          sourceDocumentId: transferId,
        },
      });
      await adjustStock({
        storeId: transfer.from_store_id,
        warehouseId: transfer.from_warehouse_id,
        productId: line.product_id,
        variantId: line.variant_id,
        quantityDelta: line.quantity_sent,
        movementType: "transfer_out",
        referenceType: "transfer_order",
        referenceId: transferId,
        createdBy: userId,
        batch: {
          batchNumber: line.batch_number ?? null,
          sourceType: "transfer",
          sourceDocumentId: transferId,
        },
      });
    }
  } else {
    throw new Error("Cannot void transfer in this status");
  }

  const updated = await transferRepo.updateTransfer(transferId, {
    status: "cancelled",
  });
  if (!updated) throw new Error("Failed to void transfer");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: transfer.from_store_id,
    userId,
    action: "transfer.voided",
    entityType: "transfer_order",
    entityId: transferId,
    metadata: { previousStatus: transfer.status },
  });
  return updated;
}
