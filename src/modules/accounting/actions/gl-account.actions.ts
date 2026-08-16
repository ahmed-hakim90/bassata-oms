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
  exportChartOfAccountsWorkbook,
  importChartOfAccounts,
  previewChartOfAccountsImport,
  type ParsedCoaImport,
} from "@/modules/accounting/services/coa-import.service";
import type { CoaImportRow } from "@/modules/accounting/lib/coa-import";
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
    revalidatePath("/accounting/accounts");
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
    revalidatePath("/accounting/accounts");
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
    revalidatePath("/accounting/accounts");
  });
}

export async function previewChartOfAccountsImportAction(
  base64: string
): Promise<GlAccountActionResult<ParsedCoaImport>> {
  return run(async () => {
    await requireFeature("general_ledger");
    await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    return previewChartOfAccountsImport(base64);
  });
}

export async function importChartOfAccountsAction(
  rows: CoaImportRow[]
): Promise<
  GlAccountActionResult<{
    created: number;
    updated: number;
    unchanged: number;
  }>
> {
  return run(async () => {
    await requireFeature("general_ledger");
    const user = await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    const result = await importChartOfAccounts(rows, user.id);
    revalidatePath("/accounting");
    revalidatePath("/accounting/accounts");
    return {
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
    };
  });
}

export async function exportChartOfAccountsAction(): Promise<
  GlAccountActionResult<{ filename: string; base64: string }>
> {
  return run(async () => {
    await requireFeature("general_ledger");
    await requirePermissionOrRole("gl_view", ["owner", "manager"]);
    return exportChartOfAccountsWorkbook();
  });
}
