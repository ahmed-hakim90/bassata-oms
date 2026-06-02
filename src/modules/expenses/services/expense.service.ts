import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { getDefaultWarehouse } from "@/lib/repositories/warehouse.repository";
import { getExpenseSettings } from "@/modules/system/services/settings.service";
import type { Expense, ExpenseSource, ExpensePaymentMethod, AppUser } from "@/lib/types";

export type CreateExpenseInput = Omit<
  Expense,
  "id" | "created_at" | "status" | "approved_by" | "approved_at"
>;

async function assertSessionEditable(sessionId: string | null) {
  if (!sessionId) return;
  const session = await sessionRepo.getSession(sessionId);
  if (session?.status === "closed") {
    throw new Error("Cannot modify expenses for a closed session");
  }
}

async function validateExpenseInput(
  input: CreateExpenseInput,
  user: AppUser,
  isSessionExpense: boolean
) {
  const settings = await getExpenseSettings();
  if (settings.prevent_expenses_in_closed_periods) {
    await assertPeriodOpen(input.store_id);
  }

  const category = await categoryRepo.getExpenseCategory(input.expense_category_id);
  if (!category?.is_active) throw new Error("Invalid expense category");

  if (input.inventory_item_id) {
    if (!input.quantity || input.quantity <= 0) {
      throw new Error("Quantity required for inventory purchase");
    }
    if (!input.unit_cost || input.unit_cost <= 0) {
      throw new Error("Unit cost required for inventory purchase");
    }
    input.amount = input.quantity * input.unit_cost;
  } else if (category.requires_inventory_item) {
    throw new Error("This category requires an inventory item");
  }

  if (isSessionExpense && user.role === "cashier") {
    if (!settings.cashier_can_add_session_expense) {
      throw new Error("Cashiers cannot add session expenses");
    }
    if (
      settings.cashier_max_expense_amount != null &&
      input.amount > settings.cashier_max_expense_amount
    ) {
      throw new Error(`Expense exceeds max amount (${settings.cashier_max_expense_amount})`);
    }
    if (input.inventory_item_id && !settings.allow_inventory_purchase_from_session) {
      throw new Error("Inventory purchase from session is disabled");
    }
  }
}

export async function listExpenses(
  storeId?: string,
  sessionId?: string
): Promise<Expense[]> {
  return expenseRepo.listExpenses({ storeId, sessionId });
}

export async function getExpense(id: string): Promise<Expense | null> {
  return expenseRepo.getExpense(id);
}

export async function createExpense(
  input: CreateExpenseInput,
  user: AppUser,
  options?: { isSessionExpense?: boolean }
): Promise<Expense> {
  const isSessionExpense = options?.isSessionExpense ?? Boolean(input.session_id);
  await validateExpenseInput(input, user, isSessionExpense);

  const settings = await getExpenseSettings();
  const status = settings.approval_required ? "pending" : "approved";
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  const approvedBy = status === "approved" ? user.id : null;

  const expense = await expenseRepo.createExpense({
    ...input,
    status,
    approved_by: approvedBy,
    approved_at: approvedAt,
  });

  if (input.inventory_item_id && input.quantity) {
    const warehouse = await getDefaultWarehouse(input.store_id);
    if (!warehouse) throw new Error("No default warehouse for store");
    await adjustStock({
      storeId: input.store_id,
      warehouseId: warehouse.id,
      productId: input.inventory_item_id,
      quantityDelta: input.quantity,
      movementType: "purchase_from_session",
      referenceType: "expense",
      referenceId: expense.id,
      reason: input.title,
      createdBy: user.id,
    });
    const product = await catalogRepo.getProduct(input.inventory_item_id);
    if (product && input.unit_cost) {
      await catalogRepo.updateProduct(input.inventory_item_id, {
        last_unit_cost: input.unit_cost,
        cost_unit: product.unit,
      });
    }
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: input.store_id,
      userId: user.id,
      action: "inventory.purchase_from_session",
      entityType: "expense",
      entityId: expense.id,
      metadata: {
        productId: input.inventory_item_id,
        quantity: input.quantity,
        unitCost: input.unit_cost,
      },
    });
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.store_id,
    userId: user.id,
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    metadata: {
      cost_center_id: input.cost_center_id,
      expense_category_id: input.expense_category_id,
      expense_source: input.expense_source,
      session_id: input.session_id,
      amount: input.amount,
    },
  });

  if (input.session_id) {
    await writeAuditLog({
      orgId,
      storeId: input.store_id,
      userId: user.id,
      action: "session.expense_recorded",
      entityType: "cashier_session",
      entityId: input.session_id,
      metadata: { expenseId: expense.id, amount: input.amount },
    });
  }

  return expense;
}

export async function updateExpense(
  id: string,
  patch: expenseRepo.ExpenseUpdatePatch,
  user: AppUser
): Promise<Expense | null> {
  const existing = await expenseRepo.getExpense(id);
  if (!existing) return null;

  if (existing.inventory_item_id) {
    throw new Error("Cannot edit inventory purchase expenses");
  }

  await assertSessionEditable(existing.session_id);
  await assertPeriodOpen(existing.store_id);

  const expense = await expenseRepo.updateExpense(id, patch);
  if (expense) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: expense.store_id,
      userId: user.id,
      action: "expense.edited",
      entityType: "expense",
      entityId: id,
    });
  }
  return expense;
}

export async function deleteExpense(id: string, user: AppUser): Promise<boolean> {
  const existing = await expenseRepo.getExpense(id);
  if (!existing) return false;

  if (existing.inventory_item_id) {
    throw new Error("Cannot delete inventory purchase expenses");
  }

  await assertSessionEditable(existing.session_id);
  await assertPeriodOpen(existing.store_id);

  const ok = await expenseRepo.deleteExpense(id);
  if (ok) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: existing.store_id,
      userId: user.id,
      action: "expense.deleted",
      entityType: "expense",
      entityId: id,
    });
  }
  return ok;
}

export async function approveExpense(id: string, user: AppUser): Promise<Expense | null> {
  const existing = await expenseRepo.getExpense(id);
  if (!existing) return null;
  if (existing.status === "approved") return existing;

  const expense = await expenseRepo.updateExpense(id, {
    status: "approved",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  });

  if (expense) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: expense.store_id,
      userId: user.id,
      action: "expense.approved",
      entityType: "expense",
      entityId: id,
    });
  }
  return expense;
}

export function affectsSessionCash(expense: {
  expense_source: ExpenseSource;
  payment_method: ExpensePaymentMethod;
}): boolean {
  return expense.expense_source === "session_cash" && expense.payment_method === "cash";
}
