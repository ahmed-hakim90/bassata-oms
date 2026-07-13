import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type {
  CustomerLedgerEntry,
  CustomerLedgerEntryType,
  CustomerPayment,
  PaymentMethod,
} from "@/lib/types";

function mapLedger(row: Record<string, unknown>): CustomerLedgerEntry {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    store_id: row.store_id as string,
    customer_id: row.customer_id as string,
    entry_type: row.entry_type as CustomerLedgerEntryType,
    debit: Number(row.debit),
    credit: Number(row.credit),
    order_id: (row.order_id as string) ?? null,
    payment_id: (row.payment_id as string) ?? null,
    reference: (row.reference as string) ?? "",
    notes: (row.notes as string) ?? "",
    created_by: row.created_by as string,
    created_at: row.created_at as string,
  };
}

function mapPayment(row: Record<string, unknown>): CustomerPayment {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    store_id: row.store_id as string,
    customer_id: row.customer_id as string,
    amount: Number(row.amount),
    payment_method: row.payment_method as PaymentMethod,
    reference: (row.reference as string) ?? "",
    notes: (row.notes as string) ?? "",
    received_at: row.received_at as string,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    voided_at: (row.voided_at as string) ?? null,
  };
}

export async function listCustomerLedger(customerId: string): Promise<CustomerLedgerEntry[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customer_ledger")
    .select("*")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });
  if (error) throwDbError(error, "listCustomerLedger");
  return (data ?? []).map((row) => mapLedger(row as Record<string, unknown>));
}

export async function listCustomerPayments(customerId: string): Promise<CustomerPayment[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customer_payments")
    .select("*")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("received_at", { ascending: false });
  if (error) throwDbError(error, "listCustomerPayments");
  return (data ?? []).map((row) => mapPayment(row as Record<string, unknown>));
}

export async function recordCustomerPaymentRpc(input: {
  storeId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await callRpc<string>("record_customer_payment", {
    p_store_id: input.storeId,
    p_customer_id: input.customerId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_reference: input.reference ?? "",
    p_notes: input.notes ?? "",
  });
  if (error) throwDbError(error, "recordCustomerPayment");
  return data as string;
}

export async function recordCustomerLedgerEntry(input: {
  storeId: string;
  customerId: string;
  entryType: CustomerLedgerEntryType;
  debit: number;
  credit: number;
  orderId?: string | null;
  paymentId?: string | null;
  reference?: string;
  notes?: string;
  createdBy: string;
}): Promise<CustomerLedgerEntry> {
  const db = await getDb();
  const orgId = await getOrgId();
  const payload = {
    org_id: orgId,
    store_id: input.storeId,
    customer_id: input.customerId,
    entry_type: input.entryType,
    debit: input.debit,
    credit: input.credit,
    order_id: input.orderId ?? null,
    payment_id: input.paymentId ?? null,
    reference: input.reference ?? "",
    notes: input.notes ?? "",
    created_by: input.createdBy,
  };
  const { data, error } = await db
    .from("customer_ledger")
    .insert(payload as never)
    .select()
    .single();
  if (error || !data) throwDbError(error, "recordCustomerLedgerEntry");
  return mapLedger(data as Record<string, unknown>);
}

export async function listCustomersWithBalance(): Promise<
  { id: string; name: string; phone: string; account_balance: number; credit_limit: number }[]
> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customers")
    .select("id, name, phone, account_balance, credit_limit")
    .eq("org_id", orgId)
    .gt("account_balance", 0)
    .order("account_balance", { ascending: false });
  if (error) throwDbError(error, "listCustomersWithBalance");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    account_balance: Number(row.account_balance),
    credit_limit: Number(row.credit_limit),
  }));
}

/** Sum non-voided customer payments for a store in [from, to] (ISO timestamps). */
export async function sumPaymentsForStoreInRange(
  storeId: string,
  from: string,
  to: string
): Promise<number> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customer_payments")
    .select("amount, voided_at")
    .eq("org_id", orgId)
    .eq("store_id", storeId)
    .gte("received_at", from)
    .lte("received_at", to)
    .is("voided_at", null);
  if (error) throwDbError(error, "sumPaymentsForStoreInRange");
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}
