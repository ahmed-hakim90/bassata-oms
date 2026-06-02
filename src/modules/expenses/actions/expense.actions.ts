"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requireFeature,
  requireAnyPermission,
  requirePermission,
} from "@/lib/auth/guards";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  approveExpense,
} from "@/modules/expenses/services/expense.service";
import type { ExpenseUpdatePatch } from "@/lib/repositories/expense.repository";
import type { CreateExpenseInput } from "@/modules/expenses/services/expense.service";

export async function createExpenseAction(
  input: CreateExpenseInput,
  options?: { isSessionExpense?: boolean }
) {
  const user = await requireAuth();
  await requireFeature("session_expenses");
  if (options?.isSessionExpense || input.session_id) {
    if (input.inventory_item_id) {
      await requirePermission("purchase_from_session_create");
    } else {
      await requireAnyPermission(["session_expense_create", "expense_create"]);
    }
  } else {
    await requirePermission("expense_create");
  }
  const expense = await createExpense(input, user, options);
  revalidatePath("/expenses");
  revalidatePath("/sessions");
  revalidatePath("/pos");
  revalidatePath("/reports");
  return expense;
}

export async function updateExpenseAction(id: string, patch: ExpenseUpdatePatch) {
  const user = await requirePermission("expense_edit");
  await requireFeature("session_expenses");
  const expense = await updateExpense(id, patch, user);
  if (!expense) throw new Error("Expense not found");
  revalidatePath("/expenses");
  revalidatePath("/sessions");
  return expense;
}

export async function deleteExpenseAction(id: string) {
  const user = await requirePermission("expense_delete");
  await requireFeature("session_expenses");
  const ok = await deleteExpense(id, user);
  if (!ok) throw new Error("Expense not found");
  revalidatePath("/expenses");
  revalidatePath("/sessions");
}

export async function approveExpenseAction(id: string) {
  const user = await requirePermission("expense_approve");
  await requireFeature("session_expenses");
  const expense = await approveExpense(id, user);
  if (!expense) throw new Error("Expense not found");
  revalidatePath("/expenses");
  return expense;
}

export async function createSessionExpenseAction(input: CreateExpenseInput) {
  return createExpenseAction(
    {
      ...input,
      expense_source: input.expense_source ?? "session_cash",
      payment_method: input.payment_method ?? "cash",
    },
    { isSessionExpense: true }
  );
}
