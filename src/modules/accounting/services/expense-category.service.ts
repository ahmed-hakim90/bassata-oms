import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { ExpenseCategory } from "@/lib/types";

export async function listExpenseCategories(
  costCenterId?: string
): Promise<ExpenseCategory[]> {
  return categoryRepo.listExpenseCategories(costCenterId);
}

export async function getExpenseCategory(id: string): Promise<ExpenseCategory | null> {
  return categoryRepo.getExpenseCategory(id);
}

export async function createExpenseCategory(
  input: {
    cost_center_id: string;
    name: string;
    requires_inventory_item?: boolean;
  },
  userId: string
): Promise<ExpenseCategory> {
  const category = await categoryRepo.createExpenseCategory(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "expense_category.created",
    entityType: "expense_category",
    entityId: category.id,
    metadata: { name: category.name, cost_center_id: category.cost_center_id },
  });
  return category;
}

export async function updateExpenseCategory(
  id: string,
  patch: Partial<Pick<ExpenseCategory, "name" | "is_active" | "requires_inventory_item">>,
  userId: string
): Promise<ExpenseCategory | null> {
  const category = await categoryRepo.updateExpenseCategory(id, patch);
  if (category) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "expense_category.edited",
      entityType: "expense_category",
      entityId: id,
      metadata: patch,
    });
  }
  return category;
}
