import type { ExpenseCategory, ExpenseSettings } from "@/lib/types";

export function suggestInventoryExpenseDefaults(
  categories: ExpenseCategory[],
  settings: ExpenseSettings
): { costCenterId: string; categoryId: string } | null {
  const centerId = settings.default_cost_center_packaging;
  if (!centerId) return null;
  const category = categories.find(
    (c) =>
      c.cost_center_id === centerId &&
      c.is_active &&
      c.requires_inventory_item
  );
  if (!category) return null;
  return { costCenterId: centerId, categoryId: category.id };
}
