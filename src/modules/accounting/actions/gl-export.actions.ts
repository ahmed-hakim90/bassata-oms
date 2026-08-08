"use server";

import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  buildReportWorkbook,
  workbookToBase64,
} from "@/modules/reports/export/excel-builder";
import { buildReportContext } from "@/modules/reports/services/report-branding.service";
import { getAccountLedgerPageData } from "@/modules/accounting/actions/account-ledger.actions";
import { getBalanceSheetPageData } from "@/modules/accounting/actions/balance-sheet.actions";
import { getIncomeStatementPageData } from "@/modules/accounting/actions/income-statement.actions";
import { getTrialBalancePageData } from "@/modules/accounting/actions/trial-balance.actions";

async function requireGlExportUser() {
  await requireFeature("general_ledger");
  return requirePermissionOrRole("gl_view", ["owner", "manager"]);
}

export async function exportTrialBalanceExcel(input: {
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{ base64: string; filename: string }> {
  const user = await requireGlExportUser();
  const data = await getTrialBalancePageData(input);
  const context = await buildReportContext(
    {
      from: data.result.from,
      to: data.result.to,
      storeId: data.storeId,
      page: 1,
      pageSize: 50,
    },
    user.name,
    data.storeId
  );
  const workbook = buildReportWorkbook({
    title: "Trial Balance",
    context,
    fileName: "trial-balance",
    sheets: [
      {
        name: "ميزان المراجعة",
        columns: [
          { header: "الكود", accessor: (r) => r.code },
          { header: "الحساب", accessor: (r) => r.name },
          { header: "النوع", accessor: (r) => r.accountType },
          { header: "مدين", accessor: (r) => r.debit },
          { header: "دائن", accessor: (r) => r.credit },
          { header: "الصافي", accessor: (r) => r.balance },
        ],
        rows: data.result.lines as unknown as Record<string, unknown>[],
        totals: {
          الكود: "الإجمالي",
          مدين: data.result.totalDebit,
          دائن: data.result.totalCredit,
          الصافي: data.result.totalDebit - data.result.totalCredit,
        },
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-trial-balance-${data.result.from}_${data.result.to}.xlsx`,
  };
}

export async function exportIncomeStatementExcel(input: {
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{ base64: string; filename: string }> {
  const user = await requireGlExportUser();
  const data = await getIncomeStatementPageData(input);
  const context = await buildReportContext(
    {
      from: data.result.from,
      to: data.result.to,
      storeId: data.storeId,
      page: 1,
      pageSize: 50,
    },
    user.name,
    data.storeId
  );
  const lines = [
    ...data.result.revenueLines.map((line) => ({
      section: line.isContraRevenue ? "خصم مبيعات" : "إيراد",
      code: line.code,
      name: line.name,
      amount: line.amount,
    })),
    ...data.result.expenseLines.map((line) => ({
      section: "مصروف",
      code: line.code,
      name: line.name,
      amount: line.amount,
    })),
    {
      section: "ملخص",
      code: "",
      name: "صافي الإيراد",
      amount: data.result.netRevenue,
    },
    {
      section: "ملخص",
      code: "",
      name: "إجمالي المصروفات",
      amount: data.result.totalExpenses,
    },
    {
      section: "ملخص",
      code: "",
      name: "صافي الربح / الخسارة",
      amount: data.result.netIncome,
    },
  ];
  const workbook = buildReportWorkbook({
    title: "Income Statement",
    context,
    fileName: "income-statement",
    sheets: [
      {
        name: "قائمة الدخل",
        columns: [
          { header: "القسم", accessor: (r) => r.section },
          { header: "الكود", accessor: (r) => r.code },
          { header: "الحساب", accessor: (r) => r.name },
          { header: "المبلغ", accessor: (r) => r.amount },
        ],
        rows: lines as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-income-statement-${data.result.from}_${data.result.to}.xlsx`,
  };
}

export async function exportBalanceSheetExcel(input: {
  asOf?: string;
  storeId?: string;
}): Promise<{ base64: string; filename: string }> {
  const user = await requireGlExportUser();
  const data = await getBalanceSheetPageData(input);
  const context = await buildReportContext(
    {
      to: data.result.asOf,
      storeId: data.storeId,
      page: 1,
      pageSize: 50,
    },
    user.name,
    data.storeId
  );
  const lines = [
    ...data.result.assets.map((line) => ({
      section: "أصول",
      code: line.code,
      name: line.name,
      balance: line.balance,
    })),
    ...data.result.liabilities.map((line) => ({
      section: "خصوم",
      code: line.code,
      name: line.name,
      balance: line.balance,
    })),
    ...data.result.equity.map((line) => ({
      section: "ملكية",
      code: line.code,
      name: line.name,
      balance: line.balance,
    })),
    {
      section: "ملكية",
      code: "",
      name: "صافي ربح السنة",
      balance: data.result.netIncomeYtd,
    },
    {
      section: "ملخص",
      code: "",
      name: "إجمالي الأصول",
      balance: data.result.totalAssets,
    },
    {
      section: "ملخص",
      code: "",
      name: "الخصوم + حقوق الملكية",
      balance: data.result.totalLiabilitiesAndEquity,
    },
  ];
  const workbook = buildReportWorkbook({
    title: "Balance Sheet",
    context,
    fileName: "balance-sheet",
    sheets: [
      {
        name: "الميزانية",
        columns: [
          { header: "القسم", accessor: (r) => r.section },
          { header: "الكود", accessor: (r) => r.code },
          { header: "الحساب", accessor: (r) => r.name },
          { header: "الرصيد", accessor: (r) => r.balance },
        ],
        rows: lines as unknown as Record<string, unknown>[],
      },
    ],
  });
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-balance-sheet-${data.result.asOf}.xlsx`,
  };
}

export async function exportAccountLedgerExcel(input: {
  accountId?: string;
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{ base64: string; filename: string }> {
  const user = await requireGlExportUser();
  const data = await getAccountLedgerPageData(input);
  if (!data.result) {
    throw new Error("مفيش حساب للتصدير");
  }
  const context = await buildReportContext(
    {
      from: data.result.from,
      to: data.result.to,
      storeId: data.storeId,
      page: 1,
      pageSize: 50,
    },
    user.name,
    data.storeId
  );
  const rows = [
    {
      entryDate: data.result.from,
      entryNumber: "",
      memo: "رصيد افتتاحي",
      debit: 0,
      credit: 0,
      runningBalance: data.result.openingBalance,
    },
    ...data.result.movements.map((row) => ({
      entryDate: row.entryDate,
      entryNumber: row.entryNumber,
      memo: row.memo,
      debit: row.debit,
      credit: row.credit,
      runningBalance: row.runningBalance,
    })),
  ];
  const workbook = buildReportWorkbook({
    title: `Ledger ${data.result.account.code}`,
    context,
    fileName: "account-ledger",
    sheets: [
      {
        name: "دفتر الأستاذ",
        columns: [
          { header: "التاريخ", accessor: (r) => r.entryDate },
          { header: "رقم القيد", accessor: (r) => r.entryNumber },
          { header: "البيان", accessor: (r) => r.memo },
          { header: "مدين", accessor: (r) => r.debit },
          { header: "دائن", accessor: (r) => r.credit },
          { header: "الرصيد", accessor: (r) => r.runningBalance },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        totals: {
          التاريخ: "الإجمالي / الختامي",
          مدين: data.result.periodDebit,
          دائن: data.result.periodCredit,
          الرصيد: data.result.closingBalance,
        },
      },
    ],
  });
  const code = data.result.account.code.replace(/[^\w.-]+/g, "_");
  return {
    base64: workbookToBase64(workbook),
    filename: `Velora-ledger-${code}-${data.result.from}_${data.result.to}.xlsx`,
  };
}
