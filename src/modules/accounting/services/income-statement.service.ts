import * as journalRepo from "@/lib/repositories/journal.repository";
import { roundMoney } from "@/lib/money";
import {
  expenseContribution,
  revenueContribution,
} from "@/modules/accounting/lib/account-balance";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";

export type IncomeStatementLine = {
  accountId: string;
  code: string;
  name: string;
  systemKey: string | null;
  amount: number;
  isContraRevenue: boolean;
};

export type IncomeStatementResult = {
  from: string;
  to: string;
  storeId: string | null;
  revenueLines: IncomeStatementLine[];
  expenseLines: IncomeStatementLine[];
  grossRevenue: number;
  salesDiscounts: number;
  netRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export async function getIncomeStatement(input: {
  from: string;
  to: string;
  storeId?: string;
}): Promise<IncomeStatementResult> {
  await ensureSeeded();
  if (!input.from || !input.to) {
    throw new Error("حدد تاريخ البداية والنهاية");
  }
  if (input.from > input.to) {
    throw new Error("تاريخ البداية لازم يكون قبل النهاية");
  }

  const rows = await journalRepo.getTrialBalanceRows({
    from: input.from,
    to: input.to,
    storeId: input.storeId,
  });

  const revenueLines: IncomeStatementLine[] = [];
  const expenseLines: IncomeStatementLine[] = [];

  for (const row of rows) {
    if (row.account_type === "revenue") {
      const amount = revenueContribution(row.debit, row.credit);
      if (amount === 0) continue;
      revenueLines.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        systemKey: row.system_key,
        amount,
        isContraRevenue: row.system_key === "sales_discount" || amount < 0,
      });
    } else if (row.account_type === "expense") {
      const amount = expenseContribution(row.debit, row.credit);
      if (amount === 0) continue;
      expenseLines.push({
        accountId: row.account_id,
        code: row.code,
        name: row.name,
        systemKey: row.system_key,
        amount,
        isContraRevenue: false,
      });
    }
  }

  revenueLines.sort((a, b) => a.code.localeCompare(b.code, "en"));
  expenseLines.sort((a, b) => a.code.localeCompare(b.code, "en"));

  const grossRevenue = roundMoney(
    revenueLines
      .filter((line) => !line.isContraRevenue)
      .reduce((sum, line) => sum + line.amount, 0)
  );
  const salesDiscounts = roundMoney(
    revenueLines
      .filter((line) => line.isContraRevenue)
      .reduce((sum, line) => sum + Math.abs(line.amount), 0)
  );
  const netRevenue = roundMoney(grossRevenue - salesDiscounts);
  const totalExpenses = roundMoney(
    expenseLines.reduce((sum, line) => sum + line.amount, 0)
  );
  const netIncome = roundMoney(netRevenue - totalExpenses);

  return {
    from: input.from,
    to: input.to,
    storeId: input.storeId ?? null,
    revenueLines,
    expenseLines,
    grossRevenue,
    salesDiscounts,
    netRevenue,
    totalExpenses,
    netIncome,
  };
}
