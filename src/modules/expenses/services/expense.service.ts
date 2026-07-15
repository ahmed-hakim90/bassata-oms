import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { getExpenseSettings } from "@/modules/system/services/settings.service";
import type {
  Expense,
  ExpenseSource,
  ExpensePaymentMethod,
  AppUser,
  ExpenseCategory,
} from "@/lib/types";

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
): Promise<ExpenseCategory> {
  const settings = await getExpenseSettings();
  if (settings.prevent_expenses_in_closed_periods) {
    await assertPeriodOpen(input.store_id);
  }

  const category = await categoryRepo.getExpenseCategory(input.expense_category_id);
  if (!category?.is_active) throw new Error("التصنيف غير صالح أو غير نشط");

  if (input.inventory_item_id) {
    throw new Error("شراء المخزون من المصروفات غير متاح — استخدم صفحة المشتريات");
  }
  if (input.expense_source === "purchase") {
    throw new Error("شراء المخزون من المصروفات غير متاح — استخدم صفحة المشتريات");
  }
  if (category.requires_inventory_item) {
    throw new Error(
      "التصنيف ده مرتبط بمخزون — اختار تصنيف مصروف عادي أو سجّل شراء من المشتريات"
    );
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
  }

  return category;
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
  const category = await validateExpenseInput(input, user, isSessionExpense);

  const settings = await getExpenseSettings();
  const status = settings.approval_required ? "pending" : "approved";
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  const approvedBy = status === "approved" ? user.id : null;

  const expense = await expenseRepo.createExpense({
    ...input,
    cost_center_id: category.cost_center_id,
    inventory_item_id: null,
    quantity: null,
    unit_cost: null,
    status,
    approved_by: approvedBy,
    approved_at: approvedAt,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.store_id,
    userId: user.id,
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    metadata: {
      cost_center_id: category.cost_center_id,
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

  let nextPatch = { ...patch };
  if (patch.expense_category_id) {
    const category = await categoryRepo.getExpenseCategory(patch.expense_category_id);
    if (!category?.is_active) throw new Error("التصنيف غير صالح أو غير نشط");
    if (category.requires_inventory_item) {
      throw new Error(
        "التصنيف ده مرتبط بمخزون — اختار تصنيف مصروف عادي أو سجّل شراء من المشتريات"
      );
    }
    nextPatch = {
      ...nextPatch,
      cost_center_id: category.cost_center_id,
    };
  }

  const expense = await expenseRepo.updateExpense(id, nextPatch);
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
