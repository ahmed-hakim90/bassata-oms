import * as journalRepo from "@/lib/repositories/journal.repository";
import * as glRepo from "@/lib/repositories/gl-account.repository";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";

export type AccountingOverview = {
  accountCount: number;
  postableCount: number;
  postedCount: number;
  draftCount: number;
  voidCount: number;
  autoPostedCount: number;
  recentPosted: {
    id: string;
    entry_number: string;
    entry_date: string;
    memo: string;
    source: string;
    status: string;
  }[];
};

export async function getAccountingOverview(): Promise<AccountingOverview> {
  await ensureSeeded();
  const [accounts, entries] = await Promise.all([
    glRepo.listGlAccounts({ activeOnly: true }),
    journalRepo.listJournalEntries({ limit: 200 }),
  ]);

  const posted = entries.filter((e) => e.status === "posted");
  const draft = entries.filter((e) => e.status === "draft");
  const voided = entries.filter((e) => e.status === "void");
  const autoPosted = posted.filter((e) => e.source !== "manual");

  return {
    accountCount: accounts.length,
    postableCount: accounts.filter((a) => a.is_postable).length,
    postedCount: posted.length,
    draftCount: draft.length,
    voidCount: voided.length,
    autoPostedCount: autoPosted.length,
    recentPosted: posted.slice(0, 8).map((e) => ({
      id: e.id,
      entry_number: e.entry_number,
      entry_date: e.entry_date,
      memo: e.memo,
      source: e.source,
      status: e.status,
    })),
  };
}
