import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { listStores } from "@/lib/repositories/store.repository";
import type {
  CashTreasury,
  CashTreasuryEntryType,
  CashTreasuryKind,
  CashTreasuryLedgerEntry,
} from "@/lib/types";

type TreasuryRow = {
  id: string;
  org_id: string;
  kind: CashTreasuryKind;
  store_id: string | null;
  balance: number | string;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: string;
  org_id: string;
  treasury_id: string;
  store_id: string | null;
  entry_type: CashTreasuryEntryType;
  amount: number | string;
  balance_after: number | string;
  counterpart_treasury_id: string | null;
  session_id: string | null;
  expense_id: string | null;
  customer_payment_id: string | null;
  supplier_payment_id: string | null;
  period_id: string | null;
  notes: string;
  created_by: string;
  created_at: string;
};

function num(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function mapTreasury(row: TreasuryRow): CashTreasury {
  return {
    id: row.id,
    org_id: row.org_id,
    kind: row.kind,
    store_id: row.store_id,
    balance: num(row.balance),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLedger(row: LedgerRow): CashTreasuryLedgerEntry {
  return {
    id: row.id,
    org_id: row.org_id,
    treasury_id: row.treasury_id,
    store_id: row.store_id,
    entry_type: row.entry_type,
    amount: num(row.amount),
    balance_after: num(row.balance_after),
    counterpart_treasury_id: row.counterpart_treasury_id,
    session_id: row.session_id,
    expense_id: row.expense_id,
    customer_payment_id: row.customer_payment_id,
    supplier_payment_id: row.supplier_payment_id,
    period_id: row.period_id,
    notes: row.notes ?? "",
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

async function treasuryTable() {
  const db = await getDb();
  return db.from("cash_treasuries");
}

async function ledgerTable() {
  const db = await getDb();
  return db.from("cash_treasury_ledger");
}

export async function ensureOrgTreasuries(): Promise<number> {
  const { data, error } = await callRpc<number>("ensure_org_treasuries", {});
  if (error) throwDbError(error, "ensureOrgTreasuries");
  return Number(data ?? 0);
}

export async function listTreasuries(): Promise<CashTreasury[]> {
  try {
    await ensureOrgTreasuries();
  } catch {
    // Cashiers can read store treasuries via RLS without ensure (privileged-only).
  }
  const table = await treasuryTable();
  const { data, error } = await table.select("*").order("kind", { ascending: true });
  if (error) throwDbError(error, "listTreasuries");
  return ((data ?? []) as TreasuryRow[]).map(mapTreasury);
}

export async function getTreasury(id: string): Promise<CashTreasury | null> {
  const table = await treasuryTable();
  const { data, error } = await table.select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getTreasury");
  return data ? mapTreasury(data as TreasuryRow) : null;
}

export async function getHqTreasury(): Promise<CashTreasury | null> {
  const table = await treasuryTable();
  const { data, error } = await table.select("*").eq("kind", "hq").maybeSingle();
  if (error) throwDbError(error, "getHqTreasury");
  return data ? mapTreasury(data as TreasuryRow) : null;
}

export async function getStoreTreasury(storeId: string): Promise<CashTreasury | null> {
  const storeIds = (await listStores()).map((s) => s.id);
  if (!storeIds.includes(storeId)) return null;
  const table = await treasuryTable();
  const { data, error } = await table
    .select("*")
    .eq("kind", "store")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throwDbError(error, "getStoreTreasury");
  return data ? mapTreasury(data as TreasuryRow) : null;
}

export async function listTreasuryLedger(input?: {
  treasuryId?: string;
  entryType?: CashTreasuryEntryType;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CashTreasuryLedgerEntry[]> {
  const table = await ledgerTable();
  let q = table.select("*").order("created_at", { ascending: false });
  if (input?.treasuryId) q = q.eq("treasury_id", input.treasuryId);
  if (input?.entryType) q = q.eq("entry_type", input.entryType);
  if (input?.from) q = q.gte("created_at", input.from);
  if (input?.to) q = q.lte("created_at", `${input.to}T23:59:59`);
  q = q.limit(input?.limit ?? 100);
  const { data, error } = await q;
  if (error) throwDbError(error, "listTreasuryLedger");
  return ((data ?? []) as LedgerRow[]).map(mapLedger);
}

export async function transfer(input: {
  fromTreasuryId: string;
  toTreasuryId: string;
  amount: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await callRpc<string>("treasury_transfer", {
    p_from_treasury_id: input.fromTreasuryId,
    p_to_treasury_id: input.toTreasuryId,
    p_amount: input.amount,
    p_notes: input.notes ?? "",
  });
  if (error || !data) throwDbError(error, "treasuryTransfer");
  return data;
}

export async function periodSweep(input: {
  storeId: string;
  periodId: string;
  notes?: string;
}): Promise<number> {
  const { data, error } = await callRpc<number>("treasury_period_sweep", {
    p_store_id: input.storeId,
    p_period_id: input.periodId,
    p_notes: input.notes ?? "",
  });
  if (error || data == null) throwDbError(error, "treasuryPeriodSweep");
  return Number(data);
}

export async function postExpense(input: {
  treasuryId: string;
  expenseId: string;
  amount: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await callRpc<string>("treasury_post_expense", {
    p_treasury_id: input.treasuryId,
    p_expense_id: input.expenseId,
    p_amount: input.amount,
    p_notes: input.notes ?? "",
  });
  if (error || !data) throwDbError(error, "treasuryPostExpense");
  return data;
}

export async function postCollection(input: {
  treasuryId: string;
  customerPaymentId: string;
  amount: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await callRpc<string>("treasury_post_collection", {
    p_treasury_id: input.treasuryId,
    p_customer_payment_id: input.customerPaymentId,
    p_amount: input.amount,
    p_notes: input.notes ?? "",
  });
  if (error || !data) throwDbError(error, "treasuryPostCollection");
  return data;
}

export async function postSupplierPay(input: {
  treasuryId: string;
  supplierPaymentId: string;
  amount: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await callRpc<string>("treasury_post_supplier_pay", {
    p_treasury_id: input.treasuryId,
    p_supplier_payment_id: input.supplierPaymentId,
    p_amount: input.amount,
    p_notes: input.notes ?? "",
  });
  if (error || !data) throwDbError(error, "treasuryPostSupplierPay");
  return data;
}

export async function reverseSupplierPay(supplierPaymentId: string): Promise<string | null> {
  const { data, error } = await callRpc<string | null>("treasury_reverse_supplier_pay", {
    p_supplier_payment_id: supplierPaymentId,
  });
  if (error) throwDbError(error, "treasuryReverseSupplierPay");
  return data ?? null;
}

export async function reverseExpense(expenseId: string): Promise<string | null> {
  const { data, error } = await callRpc<string | null>("treasury_reverse_expense", {
    p_expense_id: expenseId,
  });
  if (error) throwDbError(error, "treasuryReverseExpense");
  return data ?? null;
}

export async function reverseCollection(customerPaymentId: string): Promise<string | null> {
  const { data, error } = await callRpc<string | null>("treasury_reverse_collection", {
    p_customer_payment_id: customerPaymentId,
  });
  if (error) throwDbError(error, "treasuryReverseCollection");
  return data ?? null;
}
