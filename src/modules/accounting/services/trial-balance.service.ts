import * as journalRepo from "@/lib/repositories/journal.repository";
import { roundMoney } from "@/lib/money";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";

export type TrialBalanceLine = {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResult = {
  from: string;
  to: string;
  storeId: string | null;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
};

export async function getTrialBalance(input: {
  from: string;
  to: string;
  storeId?: string;
}): Promise<TrialBalanceResult> {
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

  const lines: TrialBalanceLine[] = rows.map((row) => {
    const debit = roundMoney(row.debit);
    const credit = roundMoney(row.credit);
    return {
      accountId: row.account_id,
      code: row.code,
      name: row.name,
      accountType: row.account_type,
      debit,
      credit,
      balance: roundMoney(debit - credit),
    };
  });

  const totalDebit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));

  return {
    from: input.from,
    to: input.to,
    storeId: input.storeId ?? null,
    lines,
    totalDebit,
    totalCredit,
  };
}
