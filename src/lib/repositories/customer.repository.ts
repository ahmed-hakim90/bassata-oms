import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapCustomer, mapLoyaltyLedger, mapLoyaltyRule } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Customer, LoyaltyLedgerEntry, LoyaltyRule } from "@/lib/types";

export async function listCustomers(search?: string): Promise<Customer[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db.from("customers").select("*").eq("org_id", orgId);

  const trimmed = search?.trim();
  if (trimmed) {
    // Strip PostgREST filter metacharacters; keep Arabic/letters/digits/spaces.
    const safe = trimmed.replace(/[%_,.()"'\\]/g, "").trim();
    if (!safe) return [];
    const pattern = `"%${safe}%"`;
    const digits = trimmed.replace(/\D/g, "");
    const filters = [`name.ilike.${pattern}`, `phone.ilike.${pattern}`, `email.ilike.${pattern}`];
    if (digits.length >= 3) {
      filters.push(`phone.ilike."%${digits}%"`);
    }
    q = q.or(filters.join(",")).limit(25);
  }

  const { data, error } = await q.order("total_spent", { ascending: false });
  if (error) throwDbError(error, "listCustomers");
  return (data ?? []).map(mapCustomer);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
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
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("customers")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateCustomer");
  return data ? mapCustomer(data) : null;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { error } = await db.from("customers").delete().eq("id", id).eq("org_id", orgId);
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

/** Org loyalty rule for settings UI — includes inactive rows. */
export async function getOrgLoyaltyRule(): Promise<LoyaltyRule | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("loyalty_rules")
    .select("*")
    .eq("org_id", orgId)
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwDbError(error, "getOrgLoyaltyRule");
  return data ? mapLoyaltyRule(data) : null;
}

export async function createLoyaltyRule(input?: {
  points_per_currency?: number;
  redemption_rate?: number;
  minimum_redeem_points?: number;
  is_active?: boolean;
}): Promise<LoyaltyRule> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("loyalty_rules")
    .insert({
      org_id: orgId,
      points_per_currency: input?.points_per_currency ?? 1,
      redemption_rate: input?.redemption_rate ?? 0.01,
      minimum_redeem_points: input?.minimum_redeem_points ?? 0,
      is_active: input?.is_active ?? true,
    })
    .select()
    .single();
  if (error) throwDbError(error, "createLoyaltyRule");
  return mapLoyaltyRule(data);
}

export async function updateLoyaltyRule(
  id: string,
  patch: Partial<LoyaltyRule>
): Promise<LoyaltyRule | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("loyalty_rules")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
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
  return Number(data?.balance_after ?? 0);
}

/** Latest loyalty balance per customer (one round-trip for POS search). */
export async function getLoyaltyBalancesByCustomerIds(
  customerIds: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  const result = new Map<string, number>();
  if (unique.length === 0) return result;

  const db = await getDb();
  const { data, error } = await db
    .from("loyalty_ledger")
    .select("customer_id, balance_after, created_at")
    .in("customer_id", unique)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "getLoyaltyBalancesByCustomerIds");

  for (const row of data ?? []) {
    const id = row.customer_id as string;
    if (result.has(id)) continue;
    result.set(id, Number(row.balance_after ?? 0));
  }
  for (const id of unique) {
    if (!result.has(id)) result.set(id, 0);
  }
  return result;
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
