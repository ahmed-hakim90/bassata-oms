import { getDb, throwDbError } from "@/lib/repositories/client";
import { mapJournalEntry, mapJournalLine } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type {
  JournalEntry,
  JournalEntryStatus,
  JournalEntryWithLines,
  JournalLine,
  JournalSource,
} from "@/lib/types";

export type JournalLineInput = {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
  line_no?: number;
};

export async function listJournalEntries(filters?: {
  storeId?: string;
  status?: JournalEntryStatus;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<JournalEntry[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  let q = db
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters?.storeId) q = q.eq("store_id", filters.storeId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.from) q = q.gte("entry_date", filters.from);
  if (filters?.to) q = q.lte("entry_date", filters.to);
  if (filters?.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throwDbError(error, "listJournalEntries");
  return (data ?? []).map(mapJournalEntry);
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throwDbError(error, "getJournalEntry");
  return data ? mapJournalEntry(data) : null;
}

export async function getJournalLines(entryId: string): Promise<JournalLine[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("journal_lines")
    .select("*")
    .eq("org_id", orgId)
    .eq("entry_id", entryId)
    .order("line_no", { ascending: true });
  if (error) throwDbError(error, "getJournalLines");
  return (data ?? []).map(mapJournalLine);
}

export async function getJournalEntryWithLines(
  id: string
): Promise<JournalEntryWithLines | null> {
  const entry = await getJournalEntry(id);
  if (!entry) return null;
  const lines = await getJournalLines(id);
  return { ...entry, lines };
}

export async function findPostedBySource(
  source: JournalSource,
  sourceId: string
): Promise<JournalEntry | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .eq("source", source)
    .eq("source_id", sourceId)
    .eq("status", "posted")
    .maybeSingle();
  if (error) throwDbError(error, "findPostedBySource");
  return data ? mapJournalEntry(data) : null;
}

export async function countEntriesForDatePrefix(prefix: string): Promise<number> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { count, error } = await db
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .like("entry_number", `${prefix}%`);
  if (error) throwDbError(error, "countEntriesForDatePrefix");
  return count ?? 0;
}

export async function createJournalEntry(input: {
  store_id?: string | null;
  entry_number: string;
  entry_date: string;
  status?: JournalEntryStatus;
  source?: JournalSource;
  source_id?: string | null;
  memo?: string;
  created_by: string;
  posted_by?: string | null;
  posted_at?: string | null;
}): Promise<JournalEntry> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("journal_entries")
    .insert({
      org_id: orgId,
      store_id: input.store_id ?? null,
      entry_number: input.entry_number,
      entry_date: input.entry_date,
      status: input.status ?? "draft",
      source: input.source ?? "manual",
      source_id: input.source_id ?? null,
      memo: input.memo ?? "",
      created_by: input.created_by,
      posted_by: input.posted_by ?? null,
      posted_at: input.posted_at ?? null,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createJournalEntry");
  return mapJournalEntry(data);
}

export async function insertJournalLines(
  entryId: string,
  lines: JournalLineInput[]
): Promise<JournalLine[]> {
  if (lines.length === 0) return [];
  const db = await getDb();
  const orgId = await getOrgId();
  const rows = lines.map((line, index) => ({
    org_id: orgId,
    entry_id: entryId,
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo ?? "",
    line_no: line.line_no ?? index + 1,
  }));
  const { data, error } = await db.from("journal_lines").insert(rows).select();
  if (error) throwDbError(error, "insertJournalLines");
  return (data ?? []).map(mapJournalLine);
}

export async function replaceJournalLines(
  entryId: string,
  lines: JournalLineInput[]
): Promise<JournalLine[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const previousLines = await getJournalLines(entryId);
  const { error: deleteError } = await db
    .from("journal_lines")
    .delete()
    .eq("entry_id", entryId)
    .eq("org_id", orgId);
  if (deleteError) throwDbError(deleteError, "replaceJournalLines.delete");
  try {
    return await insertJournalLines(entryId, lines);
  } catch (error) {
    if (previousLines.length > 0) {
      const { error: restoreError } = await db.from("journal_lines").insert(
        previousLines.map((line) => ({
          org_id: line.org_id,
          entry_id: line.entry_id,
          account_id: line.account_id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
          line_no: line.line_no,
        }))
      );
      if (restoreError) {
        throw new Error("فشل تحديث القيد وتعذر استعادة سطوره السابقة");
      }
    }
    throw error;
  }
}

export async function updateJournalEntry(
  id: string,
  patch: Partial<
    Pick<
      JournalEntry,
      | "store_id"
      | "entry_date"
      | "memo"
      | "status"
      | "posted_by"
      | "posted_at"
      | "voided_by"
      | "voided_at"
    >
  >
): Promise<JournalEntry | null> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("journal_entries")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateJournalEntry");
  return data ? mapJournalEntry(data) : null;
}

export type TrialBalanceRow = {
  account_id: string;
  code: string;
  name: string;
  account_type: string;
  system_key: string | null;
  debit: number;
  credit: number;
};

export type AccountLedgerLineRow = {
  line_id: string;
  entry_id: string;
  entry_number: string;
  entry_date: string;
  entry_memo: string;
  line_memo: string;
  debit: number;
  credit: number;
  line_no: number;
};

async function listPostedEntryIds(input: {
  orgId: string;
  from?: string;
  to?: string;
  before?: string;
  storeId?: string;
}): Promise<string[]> {
  const db = await getDb();
  let entryQuery = db
    .from("journal_entries")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("status", "posted");
  if (input.from) entryQuery = entryQuery.gte("entry_date", input.from);
  if (input.to) entryQuery = entryQuery.lte("entry_date", input.to);
  if (input.before) entryQuery = entryQuery.lt("entry_date", input.before);
  if (input.storeId) entryQuery = entryQuery.eq("store_id", input.storeId);

  const { data: entries, error: entryError } = await entryQuery;
  if (entryError) throwDbError(entryError, "listPostedEntryIds");
  return (entries ?? []).map((e) => e.id);
}

/** Aggregate posted lines in a date range (entry_date). */
export async function getTrialBalanceRows(input: {
  from: string;
  to: string;
  storeId?: string;
}): Promise<TrialBalanceRow[]> {
  const db = await getDb();
  const orgId = await getOrgId();

  const entryIds = await listPostedEntryIds({
    orgId,
    from: input.from,
    to: input.to,
    storeId: input.storeId,
  });
  if (entryIds.length === 0) return [];

  const { data: lines, error: lineError } = await db
    .from("journal_lines")
    .select("account_id, debit, credit")
    .eq("org_id", orgId)
    .in("entry_id", entryIds);
  if (lineError) throwDbError(lineError, "getTrialBalanceRows.lines");

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines ?? []) {
    const current = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
    current.debit += Number(line.debit) || 0;
    current.credit += Number(line.credit) || 0;
    totals.set(line.account_id, current);
  }

  const accountIds = [...totals.keys()];
  const { data: accounts, error: accountError } = await db
    .from("gl_accounts")
    .select("id, code, name, account_type, system_key")
    .eq("org_id", orgId)
    .in("id", accountIds);
  if (accountError) throwDbError(accountError, "getTrialBalanceRows.accounts");

  return (accounts ?? [])
    .map((account) => {
      const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        account_id: account.id,
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        system_key: account.system_key,
        debit: t.debit,
        credit: t.credit,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "en"));
}

/** Debit/credit totals for one account from posted entries before a date. */
export async function getAccountTotalsBefore(input: {
  accountId: string;
  before: string;
  storeId?: string;
}): Promise<{ debit: number; credit: number }> {
  const db = await getDb();
  const orgId = await getOrgId();
  const entryIds = await listPostedEntryIds({
    orgId,
    before: input.before,
    storeId: input.storeId,
  });
  if (entryIds.length === 0) return { debit: 0, credit: 0 };

  const { data: lines, error } = await db
    .from("journal_lines")
    .select("debit, credit")
    .eq("org_id", orgId)
    .eq("account_id", input.accountId)
    .in("entry_id", entryIds);
  if (error) throwDbError(error, "getAccountTotalsBefore");

  let debit = 0;
  let credit = 0;
  for (const line of lines ?? []) {
    debit += Number(line.debit) || 0;
    credit += Number(line.credit) || 0;
  }
  return { debit, credit };
}

/** Posted ledger lines for one account in a date range, chronological. */
export async function getAccountLedgerLines(input: {
  accountId: string;
  from: string;
  to: string;
  storeId?: string;
}): Promise<AccountLedgerLineRow[]> {
  const db = await getDb();
  const orgId = await getOrgId();

  let entryQuery = db
    .from("journal_entries")
    .select("id, entry_number, entry_date, memo")
    .eq("org_id", orgId)
    .eq("status", "posted")
    .gte("entry_date", input.from)
    .lte("entry_date", input.to)
    .order("entry_date", { ascending: true })
    .order("entry_number", { ascending: true });
  if (input.storeId) entryQuery = entryQuery.eq("store_id", input.storeId);

  const { data: entries, error: entryError } = await entryQuery;
  if (entryError) throwDbError(entryError, "getAccountLedgerLines.entries");
  if (!entries?.length) return [];

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const entryIds = entries.map((e) => e.id);

  const { data: lines, error: lineError } = await db
    .from("journal_lines")
    .select("id, entry_id, debit, credit, memo, line_no")
    .eq("org_id", orgId)
    .eq("account_id", input.accountId)
    .in("entry_id", entryIds)
    .order("line_no", { ascending: true });
  if (lineError) throwDbError(lineError, "getAccountLedgerLines.lines");

  const rows: AccountLedgerLineRow[] = [];
  for (const line of lines ?? []) {
    const entry = entryById.get(line.entry_id);
    if (!entry) continue;
    rows.push({
      line_id: line.id,
      entry_id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      entry_memo: entry.memo ?? "",
      line_memo: line.memo ?? "",
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      line_no: line.line_no,
    });
  }

  rows.sort((a, b) => {
    if (a.entry_date !== b.entry_date) {
      return a.entry_date.localeCompare(b.entry_date);
    }
    if (a.entry_number !== b.entry_number) {
      return a.entry_number.localeCompare(b.entry_number, "en");
    }
    return a.line_no - b.line_no;
  });

  return rows;
}
