import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapExpense } from "@/lib/repositories/mappers";
import type { Expense, ExpenseSource, ExpenseStatus } from "@/lib/types";

export interface ExpenseFilters {
  storeId?: string;
  sessionId?: string;
  costCenterId?: string;
  expenseCategoryId?: string;
  expenseSource?: ExpenseSource;
  from?: string;
  to?: string;
  status?: ExpenseStatus;
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const db = await getDb();
  let q = db.from("expenses").select("*").order("created_at", { ascending: false });
  if (filters.storeId) q = q.eq("store_id", filters.storeId);
  if (filters.sessionId) q = q.eq("session_id", filters.sessionId);
  if (filters.costCenterId) q = q.eq("cost_center_id", filters.costCenterId);
  if (filters.expenseCategoryId) q = q.eq("expense_category_id", filters.expenseCategoryId);
  if (filters.expenseSource) q = q.eq("expense_source", filters.expenseSource);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
  const { data, error } = await q;
  if (error) throwDbError(error, "listExpenses");
  return (data ?? []).map(mapExpense);
}

export async function listExpensesBySessionIds(sessionIds: string[]): Promise<Expense[]> {
  if (sessionIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db
    .from("expenses")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listExpensesBySessionIds");
  return (data ?? []).map(mapExpense);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDb();
  const { data, error } = await db.from("expenses").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getExpense");
  return data ? mapExpense(data) : null;
}

export async function createExpense(
  input: Omit<Expense, "id" | "created_at" | "approved_by" | "approved_at"> & {
    approved_by?: string | null;
    approved_at?: string | null;
  }
): Promise<Expense> {
  const db = await getDb();
  const { data, error } = await db.from("expenses").insert(input).select().single();
  if (error || !data) throwDbError(error, "createExpense");
  return mapExpense(data);
}

export type ExpenseUpdatePatch = Partial<
  Pick<
    Expense,
    | "cost_center_id"
    | "expense_category_id"
    | "inventory_item_id"
    | "supplier_id"
    | "title"
    | "amount"
    | "quantity"
    | "unit_cost"
    | "payment_method"
    | "expense_source"
    | "notes"
    | "receipt_url"
    | "session_id"
    | "status"
    | "approved_by"
    | "approved_at"
  >
>;

export async function updateExpense(
  id: string,
  patch: ExpenseUpdatePatch
): Promise<Expense | null> {
  const db = await getDb();
  const { data, error } = await db.from("expenses").update(patch).eq("id", id).select().maybeSingle();
  if (error) throwDbError(error, "updateExpense");
  return data ? mapExpense(data) : null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const db = await getDb();
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throwDbError(error, "deleteExpense");
  return !error;
}

export async function sumExpensesByCostCenter(filters: ExpenseFilters = {}) {
  const expenses = await listExpenses(filters);
  const totals = new Map<string, { costCenterId: string; amount: number }>();
  for (const e of expenses) {
    const existing = totals.get(e.cost_center_id) ?? {
      costCenterId: e.cost_center_id,
      amount: 0,
    };
    existing.amount += e.amount;
    totals.set(e.cost_center_id, existing);
  }
  return [...totals.values()];
}

export async function sumExpensesByCategory(filters: ExpenseFilters = {}) {
  const expenses = await listExpenses(filters);
  const totals = new Map<string, { categoryId: string; amount: number }>();
  for (const e of expenses) {
    const existing = totals.get(e.expense_category_id) ?? {
      categoryId: e.expense_category_id,
      amount: 0,
    };
    existing.amount += e.amount;
    totals.set(e.expense_category_id, existing);
  }
  return [...totals.values()];
}
