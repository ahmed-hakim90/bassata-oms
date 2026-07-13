import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapCashierVault, mapCashierVaultLedger } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import type { CashierVault, CashierVaultLedgerEntry } from "@/lib/types";
import type { CashierVaultRow } from "@/lib/supabase/database.types";

function mapVaultRpc(data: unknown): CashierVault {
  return mapCashierVault(data as CashierVaultRow);
}

async function assertOrgStore(storeId: string): Promise<boolean> {
  const storeIds = (await listStores()).map((store) => store.id);
  return storeIds.includes(storeId);
}

export async function getVault(
  storeId: string,
  cashierId: string
): Promise<CashierVault | null> {
  if (!(await assertOrgStore(storeId))) return null;

  const db = await getDb();
  const { data, error } = await db
    .from("cashier_vaults")
    .select("*")
    .eq("store_id", storeId)
    .eq("cashier_id", cashierId)
    .maybeSingle();
  if (error) throwDbError(error, "getVault");
  return data ? mapCashierVault(data) : null;
}

export async function listVaultsByStore(storeId: string): Promise<CashierVault[]> {
  if (!(await assertOrgStore(storeId))) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("cashier_vaults")
    .select("*")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throwDbError(error, "listVaultsByStore");
  return (data ?? []).map(mapCashierVault);
}

export async function listVaultLedger(
  storeId: string,
  cashierId: string,
  limit = 20
): Promise<CashierVaultLedgerEntry[]> {
  if (!(await assertOrgStore(storeId))) return [];

  const db = await getDb();
  const { data, error } = await db
    .from("cashier_vault_ledger")
    .select("*")
    .eq("store_id", storeId)
    .eq("cashier_id", cashierId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throwDbError(error, "listVaultLedger");
  return (data ?? []).map(mapCashierVaultLedger);
}

export async function takeOpeningFloat(input: {
  storeId: string;
  cashierId: string;
  amount: number;
}): Promise<CashierVault> {
  const { data, error } = await callRpc<CashierVaultRow>("cashier_vault_take_opening_float", {
    p_store_id: input.storeId,
    p_cashier_id: input.cashierId,
    p_amount: input.amount,
  });
  if (error || !data) throwDbError(error, "takeOpeningFloat");
  return mapVaultRpc(data);
}

export async function depositClosing(input: {
  storeId: string;
  cashierId: string;
  amount: number;
  sessionId: string;
}): Promise<CashierVault> {
  const { data, error } = await callRpc<CashierVaultRow>("cashier_vault_deposit_closing", {
    p_store_id: input.storeId,
    p_cashier_id: input.cashierId,
    p_amount: input.amount,
    p_session_id: input.sessionId,
  });
  if (error || !data) throwDbError(error, "depositClosing");
  return mapVaultRpc(data);
}

export async function refundOpeningFloat(input: {
  storeId: string;
  cashierId: string;
  amount: number;
}): Promise<CashierVault> {
  const { data, error } = await callRpc<CashierVaultRow>("cashier_vault_refund_opening_float", {
    p_store_id: input.storeId,
    p_cashier_id: input.cashierId,
    p_amount: input.amount,
  });
  if (error || !data) throwDbError(error, "refundOpeningFloat");
  return mapVaultRpc(data);
}

export async function adminWithdraw(input: {
  storeId: string;
  cashierId: string;
  withdrawAmount: number;
  nextOpeningFloat: number;
  notes?: string;
}): Promise<CashierVault> {
  const { data, error } = await callRpc<CashierVaultRow>("cashier_vault_admin_withdraw", {
    p_store_id: input.storeId,
    p_cashier_id: input.cashierId,
    p_withdraw_amount: input.withdrawAmount,
    p_next_opening_float: input.nextOpeningFloat,
    p_notes: input.notes ?? "",
  });
  if (error || !data) throwDbError(error, "adminWithdraw");
  return mapVaultRpc(data);
}
