"use server";

import { revalidatePath } from "next/cache";
import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { listGlAccountsFlat } from "@/modules/accounting/services/gl-account.service";
import {
  createDraftJournal,
  getJournal,
  listJournals,
  postJournal,
  voidJournal,
  type DraftLineInput,
} from "@/modules/accounting/services/journal.service";
import type { GlAccount, JournalEntry, JournalEntryStatus, Store } from "@/lib/types";

export type JournalActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "حصل خطأ";
}

async function run<T>(fn: () => Promise<T>): Promise<JournalActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function getJournalsPageData(filters?: {
  status?: JournalEntryStatus;
  from?: string;
  to?: string;
}): Promise<{
  entries: JournalEntry[];
  accounts: GlAccount[];
  stores: Store[];
  storeId: string;
  currency: string;
  canManage: boolean;
}> {
  await requireFeature("general_ledger");
  const user = await requirePermissionOrRole("gl_view", ["owner", "manager"]);
  const storeId = await getValidatedActiveStoreId();
  const [entries, accounts, stores, org] = await Promise.all([
    // Org-wide list: store filter is applied in the journals UI.
    listJournals({
      status: filters?.status,
      from: filters?.from,
      to: filters?.to,
      limit: 200,
    }),
    listGlAccountsFlat({ activeOnly: true, postableOnly: true }),
    storeRepo.listStores(),
    orgRepo.getOrganization(),
  ]);
  return {
    entries,
    accounts,
    stores,
    storeId,
    currency: org.currency,
    canManage: user.role === "owner" || user.role === "manager",
  };
}

export async function getJournalDetailAction(id: string) {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);
  return getJournal(id);
}

export async function createDraftJournalAction(input: {
  storeId: string;
  entryDate: string;
  memo?: string;
  lines: DraftLineInput[];
}): Promise<JournalActionResult<JournalEntry>> {
  return run(async () => {
    await requireFeature("general_ledger");
    const user = await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    await requireStoreAccess(input.storeId);
    const entry = await createDraftJournal({
      storeId: input.storeId,
      entryDate: input.entryDate,
      memo: input.memo,
      lines: input.lines,
      createdBy: user.id,
    });
    revalidatePath("/accounting/journals");
    return entry;
  });
}

export async function postJournalAction(
  id: string
): Promise<JournalActionResult<JournalEntry>> {
  return run(async () => {
    await requireFeature("general_ledger");
    const user = await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    const entry = await postJournal(id, user.id);
    revalidatePath("/accounting/journals");
    revalidatePath("/accounting/trial-balance");
    return entry;
  });
}

export async function voidJournalAction(
  id: string
): Promise<JournalActionResult<JournalEntry>> {
  return run(async () => {
    await requireFeature("general_ledger");
    const user = await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    const entry = await voidJournal(id, user.id);
    revalidatePath("/accounting/journals");
    revalidatePath("/accounting/trial-balance");
    return entry;
  });
}
