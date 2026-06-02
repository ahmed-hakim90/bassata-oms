"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  createExpenseCategory,
  updateExpenseCategory,
  listExpenseCategories,
} from "@/modules/accounting/services/expense-category.service";

export async function getExpenseCategoriesData(costCenterId?: string) {
  await requirePermission("expense_category_manage");
  const categories = await listExpenseCategories(costCenterId);
  return { categories };
}

export async function createExpenseCategoryAction(input: {
  cost_center_id: string;
  name: string;
  requires_inventory_item?: boolean;
}) {
  const user = await requirePermission("expense_category_manage");
  const category = await createExpenseCategory(input, user.id);
  revalidatePath("/settings/cost-centers");
  revalidatePath("/settings");
  return category;
}

export async function updateExpenseCategoryAction(
  id: string,
  patch: {
    name?: string;
    is_active?: boolean;
    requires_inventory_item?: boolean;
  }
) {
  const user = await requirePermission("expense_category_manage");
  const category = await updateExpenseCategory(id, patch, user.id);
  revalidatePath("/settings/cost-centers");
  revalidatePath("/settings");
  return category;
}

export async function toggleExpenseCategoryAction(id: string, isActive: boolean) {
  return updateExpenseCategoryAction(id, { is_active: isActive });
}
