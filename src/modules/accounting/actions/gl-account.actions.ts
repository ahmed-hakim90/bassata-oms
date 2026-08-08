"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import type { GlAccountType } from "@/lib/types";
import {
  createGlAccount,
  deactivateGlAccount,
  flattenAccountTree,
  listGlAccountTree,
  updateGlAccount,
  type GlAccountTreeNode,
} from "@/modules/accounting/services/gl-account.service";
import {
  getAccountingOverview,
  type AccountingOverview,
} from "@/modules/accounting/services/accounting-overview.service";

export type GlAccountActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "حصل خطأ";
}

async function run<T>(fn: () => Promise<T>): Promise<GlAccountActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function getChartOfAccountsData(): Promise<{
  accounts: GlAccountTreeNode[];
  flat: GlAccountTreeNode[];
  overview: AccountingOverview;
  canManage: boolean;
}> {
  await requireFeature("general_ledger");
  const user = await requirePermissionOrRole("gl_view", ["owner", "manager"]);
  const [accounts, overview] = await Promise.all([
    listGlAccountTree({ activeOnly: false }),
    getAccountingOverview(),
  ]);
  return {
    accounts,
    flat: flattenAccountTree(accounts),
    overview,
    canManage: user.role === "owner" || user.role === "manager",
  };
}

export async function createGlAccountAction(input: {
  parent_id?: string | null;
  code: string;
  name: string;
  account_type: GlAccountType;
  is_postable?: boolean;
  sort_order?: number;
}): Promise<GlAccountActionResult> {
  return run(async () => {
    await requireFeature("general_ledger");
    await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    await createGlAccount(input);
    revalidatePath("/accounting");
  });
}

export async function updateGlAccountAction(
  id: string,
  patch: {
    parent_id?: string | null;
    code?: string;
    name?: string;
    account_type?: GlAccountType;
    is_postable?: boolean;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<GlAccountActionResult> {
  return run(async () => {
    await requireFeature("general_ledger");
    await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    await updateGlAccount(id, patch);
    revalidatePath("/accounting");
  });
}

export async function deactivateGlAccountAction(
  id: string
): Promise<GlAccountActionResult> {
  return run(async () => {
    await requireFeature("general_ledger");
    await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    await deactivateGlAccount(id);
    revalidatePath("/accounting");
  });
}
