import * as journalRepo from "@/lib/repositories/journal.repository";
import { roundMoney } from "@/lib/money";
import {
  expenseContribution,
  revenueContribution,
  signedBalance,
} from "@/modules/accounting/lib/account-balance";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";

const EARLIEST = "1970-01-01";

export type BalanceSheetLine = {
  accountId: string;
  code: string;
  name: string;
  systemKey: string | null;
  balance: number;
};

export type BalanceSheetResult = {
  asOf: string;
  storeId: string | null;
  ytdFrom: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquityBook: number;
  netIncomeYtd: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
};

function yearStart(asOf: string): string {
  const year = asOf.slice(0, 4);
  return `${year}-01-01`;
}

export async function getBalanceSheet(input: {
  asOf: string;
  storeId?: string;
}): Promise<BalanceSheetResult> {
  await ensureSeeded();
  if (!input.asOf) {
    throw new Error("حدد تاريخ الميزانية");
  }

  const ytdFrom = yearStart(input.asOf);

  const [asOfRows, ytdRows] = await Promise.all([
    journalRepo.getTrialBalanceRows({
      from: EARLIEST,
      to: input.asOf,
      storeId: input.storeId,
    }),
    journalRepo.getTrialBalanceRows({
      from: ytdFrom,
      to: input.asOf,
      storeId: input.storeId,
    }),
  ]);

  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];
  const equity: BalanceSheetLine[] = [];

  for (const row of asOfRows) {
    if (
      row.account_type !== "asset" &&
      row.account_type !== "liability" &&
      row.account_type !== "equity"
    ) {
      continue;
    }
    const balance = signedBalance(row.account_type, row.debit, row.credit);
    if (balance === 0) continue;
    const line: BalanceSheetLine = {
      accountId: row.account_id,
      code: row.code,
      name: row.name,
      systemKey: row.system_key,
      balance,
    };
    if (row.account_type === "asset") assets.push(line);
    else if (row.account_type === "liability") liabilities.push(line);
    else equity.push(line);
  }

  assets.sort((a, b) => a.code.localeCompare(b.code, "en"));
  liabilities.sort((a, b) => a.code.localeCompare(b.code, "en"));
  equity.sort((a, b) => a.code.localeCompare(b.code, "en"));

  let netRevenue = 0;
  let totalExpenses = 0;
  for (const row of ytdRows) {
    if (row.account_type === "revenue") {
      netRevenue = roundMoney(
        netRevenue + revenueContribution(row.debit, row.credit)
      );
    } else if (row.account_type === "expense") {
      totalExpenses = roundMoney(
        totalExpenses + expenseContribution(row.debit, row.credit)
      );
    }
  }
  const netIncomeYtd = roundMoney(netRevenue - totalExpenses);

  const totalAssets = roundMoney(assets.reduce((s, l) => s + l.balance, 0));
  const totalLiabilities = roundMoney(
    liabilities.reduce((s, l) => s + l.balance, 0)
  );
  const totalEquityBook = roundMoney(equity.reduce((s, l) => s + l.balance, 0));
  const totalEquity = roundMoney(totalEquityBook + netIncomeYtd);
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity);
  const balanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    asOf: input.asOf,
    storeId: input.storeId ?? null,
    ytdFrom,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityBook,
    netIncomeYtd,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanced,
  };
}
