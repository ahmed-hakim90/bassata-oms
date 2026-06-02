import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { mapExpenseCategory } from "@/lib/repositories/mappers";
import type { ExpenseCategory } from "@/lib/types";

export async function listExpenseCategories(
  costCenterId?: string
): Promise<ExpenseCategory[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("expense_categories")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (costCenterId) q = q.eq("cost_center_id", costCenterId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listExpenseCategories");
  return (data ?? []).map(mapExpenseCategory);
}

export async function getExpenseCategory(
  id: string
): Promise<ExpenseCategory | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("expense_categories")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getExpenseCategory");
  return data ? mapExpenseCategory(data) : null;
}

export async function createExpenseCategory(input: {
  cost_center_id: string;
  name: string;
  requires_inventory_item?: boolean;
}): Promise<ExpenseCategory> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("expense_categories")
    .insert({
      org_id: orgId,
      cost_center_id: input.cost_center_id,
      name: input.name,
      requires_inventory_item: input.requires_inventory_item ?? false,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createExpenseCategory");
  return mapExpenseCategory(data);
}

export async function updateExpenseCategory(
  id: string,
  patch: Partial<
    Pick<ExpenseCategory, "name" | "is_active" | "requires_inventory_item">
  >
): Promise<ExpenseCategory | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("expense_categories")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateExpenseCategory");
  return data ? mapExpenseCategory(data) : null;
}
