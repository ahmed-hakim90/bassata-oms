import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as glRepo from "@/lib/repositories/gl-account.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { ExpenseCategory, GlAccount } from "@/lib/types";

export async function listExpenseCategories(
  costCenterId?: string
): Promise<ExpenseCategory[]> {
  return categoryRepo.listExpenseCategories(costCenterId);
}

export async function getExpenseCategory(id: string): Promise<ExpenseCategory | null> {
  return categoryRepo.getExpenseCategory(id);
}

export async function listPostableExpenseAccounts(): Promise<
  Pick<GlAccount, "id" | "code" | "name">[]
> {
  const accounts = await glRepo.listGlAccounts({
    activeOnly: true,
    postableOnly: true,
  });
  return accounts
    .filter((account) => account.account_type === "expense")
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
    }));
}

async function assertExpenseGlAccount(accountId: string | null | undefined): Promise<void> {
  if (!accountId) return;
  const account = await glRepo.getGlAccount(accountId);
  if (
    !account ||
    !account.is_active ||
    !account.is_postable ||
    account.account_type !== "expense"
  ) {
    throw new Error("اختار حساب مصروف تفصيلي نشط");
  }
}

export async function createExpenseCategory(
  input: {
    cost_center_id: string;
    name: string;
    requires_inventory_item?: boolean;
    gl_account_id?: string | null;
  },
  userId: string
): Promise<ExpenseCategory> {
  await assertExpenseGlAccount(input.gl_account_id);
  const category = await categoryRepo.createExpenseCategory(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "expense_category.created",
    entityType: "expense_category",
    entityId: category.id,
    metadata: {
      name: category.name,
      cost_center_id: category.cost_center_id,
      gl_account_id: category.gl_account_id,
    },
  });
  return category;
}

export async function updateExpenseCategory(
  id: string,
  patch: Partial<
    Pick<ExpenseCategory, "name" | "is_active" | "requires_inventory_item" | "gl_account_id">
  >,
  userId: string
): Promise<ExpenseCategory | null> {
  if (patch.gl_account_id !== undefined) {
    await assertExpenseGlAccount(patch.gl_account_id);
  }
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
