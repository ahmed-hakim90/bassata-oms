import * as XLSX from "xlsx";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { GlAccount } from "@/lib/types";
import {
  COA_IMPORT_MAX_BYTES,
  parseCoaImportRows,
  planCoaImport,
  summarizeCoaOpenings,
  summarizeCoaPlan,
  type CoaImportIssue,
  type CoaImportPlanOp,
  type CoaImportRow,
} from "@/modules/accounting/lib/coa-import";
import { postCoaOpeningJournal } from "@/modules/accounting/services/gl-posting.service";
import {
  createGlAccount,
  ensureSeeded,
  listGlAccountsFlat,
  updateGlAccount,
} from "@/modules/accounting/services/gl-account.service";

export type ParsedCoaImport = {
  rows: CoaImportRow[];
  errors: CoaImportIssue[];
  warnings: CoaImportIssue[];
  summary: { created: number; updated: number; unchanged: number };
  openings: { debit: number; credit: number; accounts: number };
};

const TYPE_LABEL: Record<GlAccount["account_type"], string> = {
  asset: "أصل",
  liability: "خصم",
  equity: "ملكية",
  revenue: "إيراد",
  expense: "مصروف",
};

function bufferFromBase64(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, "base64");
  if (buf.byteLength > COA_IMPORT_MAX_BYTES) {
    throw new Error("الملف أكبر من 1.5 ميجا");
  }
  if (buf.byteLength === 0) {
    throw new Error("الملف فاضي");
  }
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function pickCoaSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0] ?? {});
    const looksLikeCoa = headers.some((header) =>
      /كود|code|اسم|name/i.test(header)
    );
    if (looksLikeCoa) return sheet;
  }
  const first = workbook.SheetNames[0];
  return first ? workbook.Sheets[first] ?? null : null;
}

export function parseChartOfAccountsWorkbook(buffer: ArrayBuffer): {
  rows: CoaImportRow[];
  errors: CoaImportIssue[];
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = pickCoaSheet(workbook);
  if (!sheet) {
    return {
      rows: [],
      errors: [{ row: 0, field: "file", message: "مفيش شيت حسابات في الملف" }],
    };
  }
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return parseCoaImportRows(rawRows);
}

export async function previewChartOfAccountsImport(
  base64: string
): Promise<ParsedCoaImport> {
  await ensureSeeded();
  const parsed = parseChartOfAccountsWorkbook(bufferFromBase64(base64));
  if (parsed.errors.length > 0) {
    return {
      rows: parsed.rows,
      errors: parsed.errors,
      warnings: [],
      summary: { created: 0, updated: 0, unchanged: 0 },
      openings: summarizeCoaOpenings(parsed.rows),
    };
  }
  const existing = await listGlAccountsFlat({ activeOnly: false });
  const plan = planCoaImport(existing, parsed.rows);
  return {
    rows: parsed.rows,
    errors: plan.errors,
    warnings: plan.warnings,
    summary: summarizeCoaPlan(plan.ops),
    openings: summarizeCoaOpenings(parsed.rows),
  };
}

function sanitizeCoaImportRows(input: CoaImportRow[]): CoaImportRow[] {
  const parsed = parseCoaImportRows(
    input.map((row) => ({
      code: row.code,
      name: row.name,
      account_type: row.account_type,
      parent_code: row.parent_code ?? "",
      is_postable: row.is_postable ? "نعم" : "لا",
      sort_order: row.sort_order,
      opening_debit: row.opening_debit,
      opening_credit: row.opening_credit,
    }))
  );
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "ملف الشجرة فيه أخطاء");
  }
  return parsed.rows;
}

export async function importChartOfAccounts(
  rows: CoaImportRow[],
  userId: string,
  storeId: string
): Promise<{
  created: number;
  updated: number;
  unchanged: number;
  warnings: CoaImportIssue[];
  openingsPosted: boolean;
  openingAccounts: number;
}> {
  await ensureSeeded();
  const safeRows = sanitizeCoaImportRows(rows);
  if (safeRows.length === 0) throw new Error("مفيش حسابات في الملف");
  const existing = await listGlAccountsFlat({ activeOnly: false });
  const plan = planCoaImport(existing, safeRows);
  if (plan.errors.length > 0) {
    throw new Error(plan.errors[0]?.message ?? "ملف الشجرة فيه أخطاء");
  }

  const byCode = new Map(existing.map((account) => [account.code, account]));

  for (const op of plan.ops) {
    if (op.kind === "unchanged") continue;
    await applyCoaOp(op, byCode);
  }

  const openings = summarizeCoaOpenings(safeRows);
  let openingsPosted = false;
  if (openings.accounts > 0) {
    const lines = openingJournalLines(safeRows, byCode);
    try {
      const posted = await postCoaOpeningJournal({
        periodStoreId: storeId,
        lines,
        createdBy: userId,
      });
      openingsPosted = posted != null;
      if (!openingsPosted) {
        throw new Error("تعذر ترحيل قيد أول المدة");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "تعذر ترحيل قيد أول المدة";
      throw new Error(`الشجرة اتحفظت، لكن قيد أول المدة فشل: ${message}`);
    }
  }

  const orgId = await getOrgId();
  const summary = summarizeCoaPlan(plan.ops);
  await writeAuditLog({
    orgId,
    userId,
    action: "gl_accounts.imported",
    entityType: "gl_account",
    entityId: orgId,
    metadata: {
      ...summary,
      openingAccounts: openings.accounts,
      openingDebit: openings.debit,
      openingCredit: openings.credit,
      openingsPosted,
    },
  });

  return {
    ...summary,
    warnings: plan.warnings,
    openingsPosted,
    openingAccounts: openings.accounts,
  };
}

function openingJournalLines(
  rows: CoaImportRow[],
  byCode: Map<string, GlAccount>
): { account_id: string; debit: number; credit: number; memo?: string }[] {
  const lines: { account_id: string; debit: number; credit: number; memo?: string }[] =
    [];
  for (const row of rows) {
    if (row.opening_debit <= 0 && row.opening_credit <= 0) continue;
    const account = byCode.get(row.code);
    if (!account) {
      throw new Error(`الحساب ${row.code} مش موجود بعد الرفع`);
    }
    if (!account.is_postable) {
      throw new Error(`رصيد أول المدة للحسابات القابلة للترحيل فقط (${row.code})`);
    }
    lines.push({
      account_id: account.id,
      debit: row.opening_debit,
      credit: row.opening_credit,
      memo: `أول المدة ${row.code}`,
    });
  }
  return lines;
}

async function applyCoaOp(
  op: Extract<CoaImportPlanOp, { kind: "create" } | { kind: "update" }>,
  byCode: Map<string, GlAccount>
): Promise<void> {
  const parentId = op.row.parent_code
    ? (byCode.get(op.row.parent_code)?.id ?? null)
    : null;
  if (op.row.parent_code && !parentId) {
    throw new Error(`الحساب الأب ${op.row.parent_code} مش موجود`);
  }

  if (op.kind === "create") {
    const created = await createGlAccount({
      parent_id: parentId,
      code: op.row.code,
      name: op.row.name,
      account_type: op.row.account_type,
      is_postable: op.row.is_postable,
      sort_order: op.row.sort_order,
    });
    byCode.set(created.code, created);
    return;
  }

  const existing = byCode.get(op.row.code);
  const patch: Parameters<typeof updateGlAccount>[1] = {
    parent_id: parentId,
    name: op.row.name,
    sort_order: op.row.sort_order,
  };
  if (!existing?.is_system) {
    patch.account_type = op.row.account_type;
    patch.is_postable = op.row.is_postable;
  }
  const updated = await updateGlAccount(op.id, patch);
  byCode.set(updated.code, updated);
}

export function buildChartOfAccountsWorkbook(accounts: GlAccount[]): string {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const header = [
    "كود",
    "اسم",
    "نوع",
    "كود الأب",
    "قابل للترحيل",
    "ترتيب",
    "مدين أول المدة",
    "دائن أول المدة",
  ];
  const body = accounts.map((account) => [
    account.code,
    account.name,
    TYPE_LABEL[account.account_type],
    account.parent_id ? (byId.get(account.parent_id)?.code ?? "") : "",
    account.is_postable ? "نعم" : "لا",
    account.sort_order,
    "",
    "",
  ]);

  const dataSheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  dataSheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
  ];

  const guide = XLSX.utils.aoa_to_sheet([
    ["تعليمات رفع شجرة الحسابات"],
    [""],
    [
      "الأعمدة",
      "كود · اسم · نوع · كود الأب · قابل للترحيل · ترتيب · مدين أول المدة · دائن أول المدة",
    ],
    ["النوع", "أصل / خصم / ملكية / إيراد / مصروف"],
    ["قابل للترحيل", "نعم للحساب التفصيلي · لا للحساب التجميعي"],
    ["كود الأب", "فاضي للحساب الرئيسي"],
    [
      "أول المدة",
      "اختياري. للحسابات القابلة للترحيل فقط. المدين الإجمالي لازم يساوي الدائن. إعادة الرفع بأرصدة بتعوّض قيد أول المدة السابق.",
    ],
    [""],
    ["الاستيراد يضيف ويحدّث بالكود. الحسابات اللي مش في الملف مش بتتمسح."],
    ["حسابات النظام (الصندوق/المخزون/الموردين…) الكود والنوع بتوعهم ثابتين."],
    ["ملف بدون أرصدة أول المدة مش بيلغي القيد السابق — فاضي = تحديث الشجرة فقط."],
  ]);
  guide["!cols"] = [{ wch: 22 }, { wch: 72 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "دليل الحسابات");
  XLSX.utils.book_append_sheet(workbook, guide, "تعليمات");
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
}

export async function exportChartOfAccountsWorkbook(): Promise<{
  filename: string;
  base64: string;
}> {
  await ensureSeeded();
  const accounts = await listGlAccountsFlat({ activeOnly: false });
  return {
    filename: `Velora-chart-of-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`,
    base64: buildChartOfAccountsWorkbook(accounts),
  };
}
