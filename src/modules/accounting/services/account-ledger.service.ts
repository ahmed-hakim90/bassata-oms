import * as glRepo from "@/lib/repositories/gl-account.repository";
import * as journalRepo from "@/lib/repositories/journal.repository";
import { roundMoney } from "@/lib/money";
import {
  signedBalance,
  withRunningBalances,
} from "@/modules/accounting/lib/account-balance";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";
import type { GlAccount } from "@/lib/types";

export type AccountLedgerMovement = {
  lineId: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type AccountLedgerResult = {
  account: Pick<GlAccount, "id" | "code" | "name" | "account_type" | "system_key">;
  from: string;
  to: string;
  storeId: string | null;
  openingBalance: number;
  movements: AccountLedgerMovement[];
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
};

export async function getAccountLedger(input: {
  accountId: string;
  from: string;
  to: string;
  storeId?: string;
}): Promise<AccountLedgerResult> {
  await ensureSeeded();
  if (!input.accountId) {
    throw new Error("اختر حسابًا");
  }
  if (!input.from || !input.to) {
    throw new Error("حدد تاريخ البداية والنهاية");
  }
  if (input.from > input.to) {
    throw new Error("تاريخ البداية لازم يكون قبل النهاية");
  }

  const account = await glRepo.getGlAccount(input.accountId);
  if (!account) {
    throw new Error("الحساب غير موجود");
  }

  const [openingTotals, lineRows] = await Promise.all([
    journalRepo.getAccountTotalsBefore({
      accountId: input.accountId,
      before: input.from,
      storeId: input.storeId,
    }),
    journalRepo.getAccountLedgerLines({
      accountId: input.accountId,
      from: input.from,
      to: input.to,
      storeId: input.storeId,
    }),
  ]);

  const openingBalance = signedBalance(
    account.account_type,
    openingTotals.debit,
    openingTotals.credit
  );

  const periodDebit = roundMoney(
    lineRows.reduce((sum, row) => sum + row.debit, 0)
  );
  const periodCredit = roundMoney(
    lineRows.reduce((sum, row) => sum + row.credit, 0)
  );

  const withRunning = withRunningBalances(
    account.account_type,
    openingBalance,
    lineRows.map((row) => ({
      lineId: row.line_id,
      entryId: row.entry_id,
      entryNumber: row.entry_number,
      entryDate: row.entry_date,
      memo: row.line_memo || row.entry_memo || "",
      debit: roundMoney(row.debit),
      credit: roundMoney(row.credit),
    }))
  );

  const closingBalance =
    withRunning.length > 0
      ? withRunning[withRunning.length - 1]!.runningBalance
      : openingBalance;

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      system_key: account.system_key,
    },
    from: input.from,
    to: input.to,
    storeId: input.storeId ?? null,
    openingBalance,
    movements: withRunning,
    periodDebit,
    periodCredit,
    closingBalance,
  };
}
