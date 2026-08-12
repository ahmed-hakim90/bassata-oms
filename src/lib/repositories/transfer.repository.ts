import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapTransfer, mapTransferLine } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import type { TransferOrder, TransferOrderLine } from "@/lib/types";

async function orgStoreIds(): Promise<string[]> {
  return (await listStores()).map((store) => store.id);
}

function orgStoreOrFilter(storeIds: string[]): string {
  const list = storeIds.join(",");
  return `from_store_id.in.(${list}),to_store_id.in.(${list})`;
}

export async function listTransfers(): Promise<TransferOrder[]> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("transfer_orders")
    .select("*")
    .or(orgStoreOrFilter(storeIds))
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listTransfers");
  return (data ?? []).map(mapTransfer);
}

export async function getTransfer(id: string): Promise<TransferOrder | null> {
  const storeIds = await orgStoreIds();
  if (storeIds.length === 0) return null;

  const db = await getDb();
  const { data, error } = await db
    .from("transfer_orders")
    .select("*")
    .eq("id", id)
    .or(orgStoreOrFilter(storeIds))
    .maybeSingle();
  if (error) throwDbError(error, "getTransfer");
  return data ? mapTransfer(data) : null;
}

export async function getTransferLines(transferId: string): Promise<TransferOrderLine[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("transfer_order_lines")
    .select("*")
    .eq("transfer_id", transferId);
  if (error) throwDbError(error, "getTransferLines");
  return (data ?? []).map(mapTransferLine);
}

export async function insertTransfer(
  order: Omit<TransferOrder, "id" | "created_at">,
  lines: Omit<TransferOrderLine, "id" | "transfer_id">[]
): Promise<TransferOrder> {
  const db = await getDb();
  const { data, error } = await db.from("transfer_orders").insert(order).select().single();
  if (error || !data) throwDbError(error, "insertTransfer");
  if (lines.length > 0) {
    const { error: lineError } = await db.from("transfer_order_lines").insert(
      lines.map((l) => ({ ...l, transfer_id: data.id }))
    );
    if (lineError) {
      const { error: cleanupError } = await db
        .from("transfer_orders")
        .delete()
        .eq("id", data.id)
        .eq("status", "draft");
      if (cleanupError) {
        throw new Error(
          `فشل إنشاء سطور التحويل وتعذر حذف المسودة غير المكتملة: ${lineError.message}`
        );
      }
      throwDbError(lineError, "insertTransfer.lines");
    }
  }
  return mapTransfer(data);
}

export async function updateTransfer(
  id: string,
  patch: Partial<TransferOrder>
): Promise<TransferOrder | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("transfer_orders")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateTransfer");
  return data ? mapTransfer(data) : null;
}

export async function addTransferLine(
  line: Omit<TransferOrderLine, "id">
): Promise<TransferOrderLine> {
  const db = await getDb();
  const { data, error } = await db.from("transfer_order_lines").insert(line).select().single();
  if (error || !data) throwDbError(error, "addTransferLine");
  return mapTransferLine(data);
}

export async function updateTransferLine(
  id: string,
  patch: Partial<TransferOrderLine>
): Promise<TransferOrderLine | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("transfer_order_lines")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateTransferLine");
  return data ? mapTransferLine(data) : null;
}

export async function getTransferLine(id: string): Promise<TransferOrderLine | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("transfer_order_lines")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throwDbError(error, "getTransferLine");
  return data ? mapTransferLine(data) : null;
}

export async function deleteTransferLine(id: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("transfer_order_lines").delete().eq("id", id);
  if (error) throwDbError(error, "deleteTransferLine");
}

export async function deleteTransferLinesForTransfer(transferId: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("transfer_order_lines").delete().eq("transfer_id", transferId);
  if (error) throwDbError(error, "deleteTransferLinesForTransfer");
}

export async function deleteTransfer(id: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("transfer_orders").delete().eq("id", id);
  if (error) throwDbError(error, "deleteTransfer");
}

async function runTransferLifecycleRpc(
  fn: "send_transfer_atomic" | "receive_transfer_atomic" | "void_transfer_atomic",
  args: Record<string, unknown>
): Promise<TransferOrder> {
  const { data, error } = await callRpc<Record<string, unknown>>(fn, args);
  if (error || !data) throwDbError(error, fn);
  return mapTransfer(data as Parameters<typeof mapTransfer>[0]);
}

export function sendTransferAtomic(
  transferId: string,
  userId: string,
  preventNegativeStock: boolean
): Promise<TransferOrder> {
  return runTransferLifecycleRpc("send_transfer_atomic", {
    p_transfer_id: transferId,
    p_user_id: userId,
    p_prevent_negative: preventNegativeStock,
  });
}

export function receiveTransferAtomic(
  transferId: string,
  userId: string
): Promise<TransferOrder> {
  return runTransferLifecycleRpc("receive_transfer_atomic", {
    p_transfer_id: transferId,
    p_user_id: userId,
  });
}

export function voidTransferAtomic(
  transferId: string,
  userId: string
): Promise<TransferOrder> {
  return runTransferLifecycleRpc("void_transfer_atomic", {
    p_transfer_id: transferId,
    p_user_id: userId,
  });
}
