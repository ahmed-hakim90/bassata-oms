import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapCustomer, mapLoyaltyLedger, mapLoyaltyRule } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Customer, LoyaltyLedgerEntry, LoyaltyRule } from "@/lib/types";

export async function listCustomers(search?: string): Promise<Customer[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db.from("customers").select("*").eq("org_id", orgId);
  if (error) throwDbError(error, "listCustomers");
  let result = (data ?? []).map(mapCustomer).sort((a, b) => b.total_spent - a.total_spent);
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }
  return result;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = await getDb();
  const { data, error } = await db.from("customers").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getCustomer");
  return data ? mapCustomer(data) : null;
}

export type CreateCustomerInput = {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string;
  account_balance?: number;
  credit_limit?: number;
  payment_terms?: string;
};

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customers")
    .insert({
      org_id: orgId,
      total_spent: 0,
      visit_count: 0,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      notes: input.notes ?? "",
      account_balance: input.account_balance ?? 0,
      credit_limit: input.credit_limit ?? 0,
      payment_terms: input.payment_terms ?? "",
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createCustomer");
  return mapCustomer(data);
}

export async function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      Customer,
      "name" | "phone" | "email" | "notes" | "account_balance" | "credit_limit" | "payment_terms"
    >
  >
): Promise<Customer | null> {
  const db = await getDb();
  const { data, error } = await db.from("customers").update(patch).eq("id", id).select().maybeSingle();
  if (error) throwDbError(error, "updateCustomer");
  return data ? mapCustomer(data) : null;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const db = await getDb();
  const { error } = await db.from("customers").delete().eq("id", id);
  if (error) throwDbError(error, "deleteCustomer");
  return true;
}

export async function getLoyaltyRule(): Promise<LoyaltyRule | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("loyalty_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throwDbError(error, "getLoyaltyRule");
  return data ? mapLoyaltyRule(data) : null;
}

export async function updateLoyaltyRule(
  id: string,
  patch: Partial<LoyaltyRule>
): Promise<LoyaltyRule | null> {
  const db = await getDb();
  const { data, error } = await db.from("loyalty_rules").update(patch).eq("id", id).select().maybeSingle();
  if (error) throwDbError(error, "updateLoyaltyRule");
  return data ? mapLoyaltyRule(data) : null;
}

export async function getLoyaltyBalance(customerId: string): Promise<number> {
  const db = await getDb();
  const { data, error } = await db
    .from("loyalty_ledger")
    .select("balance_after")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwDbError(error, "getLoyaltyBalance");
  return data?.balance_after ?? 0;
}

export async function addLoyaltyEntry(
  entry: Omit<LoyaltyLedgerEntry, "id" | "created_at">
): Promise<LoyaltyLedgerEntry> {
  const db = await getDb();
  const { data, error } = await db.from("loyalty_ledger").insert(entry).select().single();
  if (error || !data) throwDbError(error, "addLoyaltyEntry");
  return mapLoyaltyLedger(data);
}

export async function listLoyaltyLedger(customerId: string): Promise<LoyaltyLedgerEntry[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("loyalty_ledger")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listLoyaltyLedger");
  return (data ?? []).map(mapLoyaltyLedger);
}
