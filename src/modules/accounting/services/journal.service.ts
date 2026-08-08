import * as glRepo from "@/lib/repositories/gl-account.repository";
import * as journalRepo from "@/lib/repositories/journal.repository";
import { roundMoney } from "@/lib/money";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { assertJournalBalanced } from "@/modules/accounting/lib/journal-balance";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";
import type {
  JournalEntry,
  JournalEntryStatus,
  JournalEntryWithLines,
  JournalSource,
} from "@/lib/types";

export type DraftLineInput = {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateCompact(entryDate: string): string {
  return entryDate.replace(/-/g, "");
}

export async function generateEntryNumber(entryDate: string): Promise<string> {
  const prefix = `JE-${dateCompact(entryDate)}-`;
  const count = await journalRepo.countEntriesForDatePrefix(prefix);
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

async function validateLines(lines: DraftLineInput[]): Promise<void> {
  assertJournalBalanced(lines);
  for (const line of lines) {
    const account = await glRepo.getGlAccount(line.account_id);
    if (!account || !account.is_active) {
      throw new Error("حساب القيد غير موجود أو غير نشط");
    }
    if (!account.is_postable) {
      throw new Error(`الحساب ${account.code} مش قابل للترحيل`);
    }
  }
}

export async function listJournals(filters?: {
  storeId?: string;
  status?: JournalEntryStatus;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<JournalEntry[]> {
  await ensureSeeded();
  return journalRepo.listJournalEntries(filters);
}

export async function getJournal(id: string): Promise<JournalEntryWithLines | null> {
  await ensureSeeded();
  return journalRepo.getJournalEntryWithLines(id);
}

export async function createDraftJournal(input: {
  storeId?: string | null;
  entryDate?: string;
  memo?: string;
  lines: DraftLineInput[];
  createdBy: string;
  source?: JournalSource;
  sourceId?: string | null;
}): Promise<JournalEntryWithLines> {
  await ensureSeeded();
  const entryDate = input.entryDate ?? todayDate();
  await validateLines(input.lines);

  const entryNumber = await generateEntryNumber(entryDate);
  const entry = await journalRepo.createJournalEntry({
    store_id: input.storeId ?? null,
    entry_number: entryNumber,
    entry_date: entryDate,
    status: "draft",
    source: input.source ?? "manual",
    source_id: input.sourceId ?? null,
    memo: input.memo ?? "",
    created_by: input.createdBy,
  });

  const lines = await journalRepo.insertJournalLines(
    entry.id,
    input.lines.map((line, index) => ({
      account_id: line.account_id,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      memo: line.memo ?? "",
      line_no: index + 1,
    }))
  );

  return { ...entry, lines };
}

export async function updateDraftJournal(input: {
  id: string;
  storeId?: string | null;
  entryDate?: string;
  memo?: string;
  lines: DraftLineInput[];
}): Promise<JournalEntryWithLines> {
  await ensureSeeded();
  const existing = await journalRepo.getJournalEntry(input.id);
  if (!existing) throw new Error("القيد غير موجود");
  if (existing.status !== "draft") {
    throw new Error("تعديل المسودة فقط");
  }
  await validateLines(input.lines);

  const updated = await journalRepo.updateJournalEntry(input.id, {
    store_id: input.storeId ?? existing.store_id,
    entry_date: input.entryDate ?? existing.entry_date,
    memo: input.memo ?? existing.memo,
  });
  if (!updated) throw new Error("فشل تحديث القيد");

  const lines = await journalRepo.replaceJournalLines(
    input.id,
    input.lines.map((line, index) => ({
      account_id: line.account_id,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      memo: line.memo ?? "",
      line_no: index + 1,
    }))
  );

  return { ...updated, lines };
}

export async function postJournal(
  id: string,
  userId: string
): Promise<JournalEntryWithLines> {
  await ensureSeeded();
  const existing = await journalRepo.getJournalEntryWithLines(id);
  if (!existing) throw new Error("القيد غير موجود");
  if (existing.status !== "draft") {
    throw new Error("ترحيل المسودة فقط");
  }
  if (!existing.store_id) {
    throw new Error("اختار الفرع قبل الترحيل");
  }

  await assertPeriodOpen(existing.store_id, `${existing.entry_date}T12:00:00.000Z`);
  await validateLines(existing.lines);

  const updated = await journalRepo.updateJournalEntry(id, {
    status: "posted",
    posted_by: userId,
    posted_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("فشل ترحيل القيد");
  return { ...updated, lines: existing.lines };
}

export async function voidJournal(
  id: string,
  userId: string
): Promise<JournalEntryWithLines> {
  await ensureSeeded();
  const existing = await journalRepo.getJournalEntryWithLines(id);
  if (!existing) throw new Error("القيد غير موجود");
  if (existing.status !== "posted") {
    throw new Error("إلغاء الترحيل للقيود المرحلة فقط");
  }
  if (existing.store_id) {
    await assertPeriodOpen(existing.store_id, `${existing.entry_date}T12:00:00.000Z`);
  }

  const updated = await journalRepo.updateJournalEntry(id, {
    status: "void",
    voided_by: userId,
    voided_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("فشل إلغاء القيد");
  return { ...updated, lines: existing.lines };
}

/** Create and immediately post an auto journal (idempotent by source+sourceId). */
export async function createAndPostAutoJournal(input: {
  storeId: string;
  entryDate: string;
  memo: string;
  source: JournalSource;
  sourceId: string;
  lines: DraftLineInput[];
  createdBy: string;
}): Promise<JournalEntryWithLines | null> {
  await ensureSeeded();
  if (!input.sourceId) return null;

  const existing = await journalRepo.findPostedBySource(input.source, input.sourceId);
  if (existing) {
    return journalRepo.getJournalEntryWithLines(existing.id);
  }

  await assertPeriodOpen(input.storeId, `${input.entryDate}T12:00:00.000Z`);
  await validateLines(input.lines);

  const entryNumber = await generateEntryNumber(input.entryDate);
  const now = new Date().toISOString();
  const entry = await journalRepo.createJournalEntry({
    store_id: input.storeId,
    entry_number: entryNumber,
    entry_date: input.entryDate,
    status: "posted",
    source: input.source,
    source_id: input.sourceId,
    memo: input.memo,
    created_by: input.createdBy,
    posted_by: input.createdBy,
    posted_at: now,
  });

  const lines = await journalRepo.insertJournalLines(
    entry.id,
    input.lines.map((line, index) => ({
      account_id: line.account_id,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      memo: line.memo ?? "",
      line_no: index + 1,
    }))
  );

  return { ...entry, lines };
}
