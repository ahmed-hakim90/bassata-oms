import type { GlAccount, GlAccountType } from "@/lib/types";
import { roundMoney } from "@/lib/money";

export const COA_IMPORT_MAX_ROWS = 2000;
export const COA_IMPORT_MAX_BYTES = 1_500_000;

export const COA_IMPORT_COLUMNS = [
  "code",
  "name",
  "account_type",
  "parent_code",
  "is_postable",
  "sort_order",
  "opening_debit",
  "opening_credit",
] as const;

export type CoaImportColumn = (typeof COA_IMPORT_COLUMNS)[number];

export type CoaImportRow = {
  row: number;
  code: string;
  name: string;
  account_type: GlAccountType;
  parent_code: string | null;
  is_postable: boolean;
  sort_order: number;
  opening_debit: number;
  opening_credit: number;
};

export type CoaImportIssue = {
  row: number;
  field: string;
  message: string;
};

export type CoaImportPlanOp =
  | { kind: "create"; row: CoaImportRow }
  | { kind: "update"; id: string; row: CoaImportRow }
  | { kind: "unchanged"; id: string; row: CoaImportRow };

export type CoaImportPlan = {
  ops: CoaImportPlanOp[];
  errors: CoaImportIssue[];
  warnings: CoaImportIssue[];
};

const HEADER_ALIASES: Record<string, CoaImportColumn> = {
  code: "code",
  account_code: "code",
  "كود": "code",
  "الكود": "code",
  "رقم": "code",
  "رقم الحساب": "code",
  "كود الحساب": "code",
  name: "name",
  account_name: "name",
  "اسم": "name",
  "الاسم": "name",
  "اسم الحساب": "name",
  "الحساب": "name",
  account_type: "account_type",
  type: "account_type",
  "نوع": "account_type",
  "النوع": "account_type",
  "نوع الحساب": "account_type",
  parent_code: "parent_code",
  parent: "parent_code",
  parent_account: "parent_code",
  "أب": "parent_code",
  "الاب": "parent_code",
  "الأب": "parent_code",
  "كود الأب": "parent_code",
  "كود الاب": "parent_code",
  "الحساب الأب": "parent_code",
  is_postable: "is_postable",
  postable: "is_postable",
  "قابل للترحيل": "is_postable",
  "ترحيل": "is_postable",
  "تجميعي": "is_postable",
  sort_order: "sort_order",
  sort: "sort_order",
  order: "sort_order",
  "ترتيب": "sort_order",
  "الترتيب": "sort_order",
  opening_debit: "opening_debit",
  debit: "opening_debit",
  "مدين": "opening_debit",
  "مدين أول المدة": "opening_debit",
  "رصيد مدين": "opening_debit",
  opening_credit: "opening_credit",
  credit: "opening_credit",
  "دائن": "opening_credit",
  "دائن أول المدة": "opening_credit",
  "رصيد دائن": "opening_credit",
};

const TYPE_ALIASES: Record<string, GlAccountType> = {
  asset: "asset",
  assets: "asset",
  "أصل": "asset",
  "اصول": "asset",
  "أصول": "asset",
  "الأصول": "asset",
  "الاصل": "asset",
  liability: "liability",
  liabilities: "liability",
  "خصم": "liability",
  "خصوم": "liability",
  "الخصوم": "liability",
  "التزام": "liability",
  "التزامات": "liability",
  equity: "equity",
  "ملكية": "equity",
  "حقوق ملكية": "equity",
  "حقوق الملكية": "equity",
  "راس مال": "equity",
  "رأس مال": "equity",
  revenue: "revenue",
  income: "revenue",
  "إيراد": "revenue",
  "ايراد": "revenue",
  "إيرادات": "revenue",
  "ايرادات": "revenue",
  "الإيرادات": "revenue",
  expense: "expense",
  expenses: "expense",
  "مصروف": "expense",
  "مصروفات": "expense",
  "المصروفات": "expense",
  "تكلفة": "expense",
};

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "نعم", "قابل", "postable"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "لا", "تجميعي", "header"]);

export function normalizeCoaHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function resolveCoaHeader(raw: string): CoaImportColumn | null {
  const key = normalizeCoaHeader(raw);
  if ((COA_IMPORT_COLUMNS as readonly string[]).includes(key)) {
    return key as CoaImportColumn;
  }
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[raw.trim()] ?? null;
}

export function parseCoaAccountType(raw: unknown): GlAccountType | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  const direct = TYPE_ALIASES[value] ?? TYPE_ALIASES[String(raw ?? "").trim()];
  return direct ?? null;
}

export function parseCoaBoolean(raw: unknown, fallback: boolean): boolean | null {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  const key = value.toLowerCase();
  if (TRUE_VALUES.has(key) || TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(key) || FALSE_VALUES.has(value)) return false;
  return null;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseSortOrder(raw: unknown, code: string): number {
  const value = cellText(raw);
  if (!value) {
    const numeric = Number(code);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function parseOpeningAmount(raw: unknown): number | null {
  const value = cellText(raw).replace(/,/g, "");
  if (!value) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

export function mapRawCoaRow(
  raw: Record<string, unknown>,
  excelRow: number
): { row: CoaImportRow | null; errors: CoaImportIssue[] } {
  const mapped: Partial<Record<CoaImportColumn, unknown>> = {};
  for (const [header, value] of Object.entries(raw)) {
    const column = resolveCoaHeader(header);
    if (!column) continue;
    mapped[column] = value;
  }

  const code = cellText(mapped.code);
  const name = cellText(mapped.name);
  if (!code && !name) {
    return { row: null, errors: [] };
  }

  const errors: CoaImportIssue[] = [];
  if (!code) {
    errors.push({ row: excelRow, field: "code", message: "كود الحساب مطلوب" });
  } else if (code.length > 32) {
    errors.push({ row: excelRow, field: "code", message: "الكود أطول من 32 حرف" });
  }
  if (!name) {
    errors.push({ row: excelRow, field: "name", message: "اسم الحساب مطلوب" });
  } else if (name.length > 120) {
    errors.push({ row: excelRow, field: "name", message: "الاسم أطول من 120 حرف" });
  }

  const accountType = parseCoaAccountType(mapped.account_type);
  if (!accountType) {
    errors.push({
      row: excelRow,
      field: "account_type",
      message: "النوع لازم يكون أصل أو خصم أو ملكية أو إيراد أو مصروف",
    });
  }

  const postable = parseCoaBoolean(mapped.is_postable, true);
  if (postable == null) {
    errors.push({
      row: excelRow,
      field: "is_postable",
      message: "قابل للترحيل: نعم أو لا",
    });
  }

  const parentCode = cellText(mapped.parent_code) || null;
  if (parentCode && parentCode === code) {
    errors.push({
      row: excelRow,
      field: "parent_code",
      message: "الحساب مش ممكن يبقى أب لنفسه",
    });
  }

  const openingDebit = parseOpeningAmount(mapped.opening_debit);
  const openingCredit = parseOpeningAmount(mapped.opening_credit);
  if (openingDebit == null) {
    errors.push({
      row: excelRow,
      field: "opening_debit",
      message: "مدين أول المدة لازم يكون رقم صفر أو أكبر",
    });
  }
  if (openingCredit == null) {
    errors.push({
      row: excelRow,
      field: "opening_credit",
      message: "دائن أول المدة لازم يكون رقم صفر أو أكبر",
    });
  }

  if (errors.length > 0 || !accountType || postable == null || !code || !name) {
    return { row: null, errors };
  }

  return {
    row: {
      row: excelRow,
      code,
      name,
      account_type: accountType,
      parent_code: parentCode,
      is_postable: postable,
      sort_order: parseSortOrder(mapped.sort_order, code),
      opening_debit: openingDebit ?? 0,
      opening_credit: openingCredit ?? 0,
    },
    errors: [],
  };
}

export function parseCoaImportRows(
  rawRows: Record<string, unknown>[]
): { rows: CoaImportRow[]; errors: CoaImportIssue[] } {
  if (rawRows.length > COA_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          field: "file",
          message: `الملف فيه أكتر من ${COA_IMPORT_MAX_ROWS} حساب`,
        },
      ],
    };
  }

  const rows: CoaImportRow[] = [];
  const errors: CoaImportIssue[] = [];
  const seen = new Map<string, number>();

  rawRows.forEach((raw, index) => {
    const excelRow = index + 2;
    const parsed = mapRawCoaRow(raw, excelRow);
    errors.push(...parsed.errors);
    if (!parsed.row) return;
    const previous = seen.get(parsed.row.code);
    if (previous != null) {
      errors.push({
        row: excelRow,
        field: "code",
        message: `الكود ${parsed.row.code} مكرر مع صف ${previous}`,
      });
      return;
    }
    seen.set(parsed.row.code, excelRow);
    rows.push(parsed.row);
  });

  return { rows, errors };
}

/** Parents in the file come before children. Parents already in DB have no file edge. */
export function orderCoaImportRows(
  rows: CoaImportRow[]
): { ordered: CoaImportRow[]; errors: CoaImportIssue[] } {
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const incoming = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const row of rows) {
    incoming.set(row.code, incoming.get(row.code) ?? 0);
    const parent = row.parent_code;
    if (!parent || !byCode.has(parent)) continue;
    incoming.set(row.code, (incoming.get(row.code) ?? 0) + 1);
    const list = children.get(parent) ?? [];
    list.push(row.code);
    children.set(parent, list);
  }

  const queue = rows
    .filter((row) => (incoming.get(row.code) ?? 0) === 0)
    .map((row) => row.code);
  const ordered: CoaImportRow[] = [];

  while (queue.length > 0) {
    const code = queue.shift()!;
    const row = byCode.get(code);
    if (!row) continue;
    ordered.push(row);
    for (const child of children.get(code) ?? []) {
      const next = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, next);
      if (next === 0) queue.push(child);
    }
  }

  if (ordered.length !== rows.length) {
    const leftover = rows.filter((row) => !ordered.some((o) => o.code === row.code));
    return {
      ordered: [],
      errors: leftover.map((row) => ({
        row: row.row,
        field: "parent_code",
        message: "دورة في الشجرة (أب يشير لفرع تحته)",
      })),
    };
  }

  return { ordered, errors: [] };
}

type ExistingAccount = Pick<
  GlAccount,
  | "id"
  | "code"
  | "name"
  | "account_type"
  | "parent_id"
  | "is_postable"
  | "is_system"
  | "sort_order"
>;

export function planCoaImport(
  existing: ExistingAccount[],
  rows: CoaImportRow[]
): CoaImportPlan {
  const errors: CoaImportIssue[] = [];
  const warnings: CoaImportIssue[] = [];
  const orderedResult = orderCoaImportRows(rows);
  errors.push(...orderedResult.errors);
  if (orderedResult.errors.length > 0) {
    return { ops: [], errors, warnings };
  }

  const byCode = new Map(existing.map((account) => [account.code, account]));
  const idToCode = new Map(existing.map((account) => [account.id, account.code]));
  const parentByCode = new Map<string, string | null>();
  for (const account of existing) {
    parentByCode.set(
      account.code,
      account.parent_id ? (idToCode.get(account.parent_id) ?? null) : null
    );
  }

  const fileCodes = new Set(rows.map((row) => row.code));
  const ops: CoaImportPlanOp[] = [];

  for (const row of orderedResult.ordered) {
    if (row.parent_code) {
      const parentExisting = byCode.get(row.parent_code);
      const parentInFile = fileCodes.has(row.parent_code);
      if (!parentExisting && !parentInFile) {
        errors.push({
          row: row.row,
          field: "parent_code",
          message: `الحساب الأب ${row.parent_code} مش موجود`,
        });
        continue;
      }
      const parentType = parentExisting?.account_type
        ?? rows.find((r) => r.code === row.parent_code)?.account_type;
      if (parentType && parentType !== row.account_type) {
        errors.push({
          row: row.row,
          field: "account_type",
          message: "نوع الحساب لازم يطابق الحساب الأب",
        });
        continue;
      }
    }

    parentByCode.set(row.code, row.parent_code);
    const current = byCode.get(row.code);
    if (!current) {
      ops.push({ kind: "create", row });
      continue;
    }

    if (current.is_system) {
      if (row.account_type !== current.account_type) {
        errors.push({
          row: row.row,
          field: "account_type",
          message: `حساب النظام ${row.code} نوعه ثابت`,
        });
        continue;
      }
      if (row.is_postable !== current.is_postable) {
        warnings.push({
          row: row.row,
          field: "is_postable",
          message: `حساب النظام ${row.code} قابلية الترحيل مش هتتغيّر`,
        });
      }
    }

    const currentParentCode = current.parent_id
      ? (idToCode.get(current.parent_id) ?? null)
      : null;
    const unchanged =
      current.name === row.name &&
      current.account_type === row.account_type &&
      currentParentCode === row.parent_code &&
      (current.is_system || current.is_postable === row.is_postable) &&
      current.sort_order === row.sort_order;

    ops.push(
      unchanged
        ? { kind: "unchanged", id: current.id, row }
        : { kind: "update", id: current.id, row }
    );
  }

  if (errors.length > 0) {
    return { ops: [], errors, warnings };
  }

  const cycle = findParentCycle(parentByCode);
  if (cycle) {
    errors.push({
      row: 0,
      field: "parent_code",
      message: `دورة في الشجرة عند ${cycle}`,
    });
    return { ops: [], errors, warnings };
  }

  errors.push(...validateCoaOpenings(rows));
  if (errors.length > 0) {
    return { ops: [], errors, warnings };
  }

  return { ops, errors, warnings };
}

export function validateCoaOpenings(rows: CoaImportRow[]): CoaImportIssue[] {
  const errors: CoaImportIssue[] = [];
  let debit = 0;
  let credit = 0;
  for (const row of rows) {
    if (row.opening_debit > 0 && row.opening_credit > 0) {
      errors.push({
        row: row.row,
        field: "opening_debit",
        message: "الحساب مينفعش يبقى مدين ودائن في نفس الصف",
      });
    }
    if ((row.opening_debit > 0 || row.opening_credit > 0) && !row.is_postable) {
      errors.push({
        row: row.row,
        field: "opening_debit",
        message: "رصيد أول المدة للحسابات القابلة للترحيل فقط",
      });
    }
    debit += row.opening_debit;
    credit += row.opening_credit;
  }
  debit = roundMoney(debit);
  credit = roundMoney(credit);
  if ((debit > 0 || credit > 0) && Math.abs(debit - credit) >= 0.01) {
    errors.push({
      row: 0,
      field: "opening_debit",
      message: `أرصدة أول المدة مش متوازنة — مدين ${debit.toFixed(2)} ≠ دائن ${credit.toFixed(2)}`,
    });
  }
  return errors;
}

export function summarizeCoaOpenings(rows: CoaImportRow[]): {
  debit: number;
  credit: number;
  accounts: number;
} {
  return {
    debit: roundMoney(rows.reduce((sum, row) => sum + row.opening_debit, 0)),
    credit: roundMoney(rows.reduce((sum, row) => sum + row.opening_credit, 0)),
    accounts: rows.filter((row) => row.opening_debit > 0 || row.opening_credit > 0).length,
  };
}

function findParentCycle(parentByCode: Map<string, string | null>): string | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function walk(code: string): string | null {
    if (visited.has(code)) return null;
    if (visiting.has(code)) return code;
    visiting.add(code);
    const parent = parentByCode.get(code);
    if (parent) {
      const hit = walk(parent);
      if (hit) return hit;
    }
    visiting.delete(code);
    visited.add(code);
    return null;
  }

  for (const code of parentByCode.keys()) {
    const hit = walk(code);
    if (hit) return hit;
  }
  return null;
}

export function summarizeCoaPlan(ops: CoaImportPlanOp[]): {
  created: number;
  updated: number;
  unchanged: number;
} {
  return {
    created: ops.filter((op) => op.kind === "create").length,
    updated: ops.filter((op) => op.kind === "update").length,
    unchanged: ops.filter((op) => op.kind === "unchanged").length,
  };
}
