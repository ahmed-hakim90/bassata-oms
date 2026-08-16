import * as auditRepo from "@/lib/repositories/audit.repository";
import * as glRepo from "@/lib/repositories/gl-account.repository";
import * as journalRepo from "@/lib/repositories/journal.repository";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import {
  buildCustomerPaymentJournalLines,
  buildCustomsCertificateJournalLines,
  buildExpenseJournalLines,
  buildPurchaseJournalLines,
  buildPurchaseReturnJournalLines,
  buildSaleJournalLines,
  buildStockCountJournalLines,
  buildSupplierPaymentJournalLines,
  buildWasteJournalLines,
  reverseBuiltLines,
  type BuiltGlLine,
} from "@/modules/accounting/lib/gl-posting-lines";
import { createAndPostAutoJournal } from "@/modules/accounting/services/journal.service";
import { ensureSeeded } from "@/modules/accounting/services/gl-account.service";
import type {
  JournalEntryWithLines,
  JournalSource,
  PaymentMethod,
} from "@/lib/types";
import { GL_POSTING_FAILED_ACTION } from "@/modules/accounting/lib/gl-posting-failure-labels";

type SoftFailContext = {
  storeId?: string | null;
  entityId: string;
  source: string;
};

async function resolveSystemAccountIds(
  keys: string[]
): Promise<Map<string, string>> {
  await ensureSeeded();
  const map = new Map<string, string>();
  for (const key of keys) {
    if (map.has(key)) continue;
    const account = await glRepo.getGlAccountBySystemKey(key);
    if (!account) {
      throw new Error(`حساب النظام غير موجود: ${key}`);
    }
    map.set(key, account.id);
  }
  return map;
}

async function linesFromBuilt(built: BuiltGlLine[]) {
  const keys = [...new Set(built.map((line) => line.systemKey))];
  const ids = await resolveSystemAccountIds(keys);
  return built.map((line) => ({
    account_id: ids.get(line.systemKey)!,
    debit: line.debit,
    credit: line.credit,
    memo: line.memo ?? "",
  }));
}

function entryDateFrom(isoOrDate?: string): string {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return isoOrDate.slice(0, 10);
}

async function glEnabled(): Promise<boolean> {
  try {
    return await isFeatureEnabled("general_ledger");
  } catch {
    return false;
  }
}

export async function postSaleJournal(input: {
  orderId: string;
  storeId: string;
  total: number;
  tax: number;
  discount: number;
  payments: { method: PaymentMethod; amount: number }[];
  cogs?: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildSaleJournalLines({
    total: input.total,
    tax: input.tax,
    discount: input.discount,
    payments: input.payments,
    cogs: input.cogs,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `بيع ${input.orderId.slice(0, 8)}`,
    source: "sale",
    sourceId: input.orderId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postExpenseJournal(input: {
  expenseId: string;
  storeId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildExpenseJournalLines({
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `مصروف ${input.expenseId.slice(0, 8)}`,
    source: "expense",
    sourceId: input.expenseId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postPurchaseJournal(input: {
  purchaseId: string;
  storeId: string;
  total: number;
  amountPaid: number;
  paymentMethod?: PaymentMethod;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildPurchaseJournalLines({
    total: input.total,
    amountPaid: input.amountPaid,
    paymentMethod: input.paymentMethod,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `شراء ${input.purchaseId.slice(0, 8)}`,
    source: "purchase",
    sourceId: input.purchaseId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postCustomsCertificateJournal(input: {
  certificateId: string;
  costId: string;
  storeId: string;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildCustomsCertificateJournalLines({
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `شهادة جمركية ${input.certificateId.slice(0, 8)}`,
    source: "customs_certificate",
    sourceId: input.costId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postCustomerPaymentJournal(input: {
  paymentId: string;
  storeId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildCustomerPaymentJournalLines({
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `تحصيل عميل ${input.paymentId.slice(0, 8)}`,
    source: "customer_payment",
    sourceId: input.paymentId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postSupplierPaymentJournal(input: {
  paymentId: string;
  storeId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildSupplierPaymentJournalLines({
    amount: input.amount,
    paymentMethod: input.paymentMethod,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `دفعة مورد ${input.paymentId.slice(0, 8)}`,
    source: "supplier_payment",
    sourceId: input.paymentId,
    lines,
    createdBy: input.createdBy,
  });
}

/** Reverse a previously posted auto-journal by flipping its lines. */
export async function reversePostedBySource(input: {
  originalSource: JournalSource;
  originalSourceId: string;
  reverseSource: JournalSource;
  reverseSourceId: string;
  storeId: string;
  entryDate?: string;
  createdBy: string;
  memo: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const original = await journalRepo.findPostedBySource(
    input.originalSource,
    input.originalSourceId
  );
  if (!original) return null;
  const withLines = await journalRepo.getJournalEntryWithLines(original.id);
  if (!withLines?.lines.length) return null;

  const lines = withLines.lines.map((line) => ({
    account_id: line.account_id,
    debit: line.credit,
    credit: line.debit,
    memo: line.memo,
  }));

  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo,
    source: input.reverseSource,
    sourceId: input.reverseSourceId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postSaleReversalJournal(input: {
  orderId: string;
  storeId: string;
  kind: "void" | "refund";
  total: number;
  tax: number;
  discount: number;
  payments: { method: PaymentMethod; amount: number }[];
  cogs?: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const reverseSourceId = `${input.kind}:${input.orderId}`;
  const reversed = await reversePostedBySource({
    originalSource: "sale",
    originalSourceId: input.orderId,
    reverseSource: "refund",
    reverseSourceId,
    storeId: input.storeId,
    entryDate: input.entryDate,
    createdBy: input.createdBy,
    memo: input.memo ?? (input.kind === "void" ? "إلغاء بيع" : "مرتجع بيع"),
  });
  if (reversed) return reversed;

  // Fallback when original sale JE was never posted (legacy orders).
  const built = reverseBuiltLines(
    buildSaleJournalLines({
      total: input.total,
      tax: input.tax,
      discount: input.discount,
      payments: input.payments,
      cogs: input.cogs,
    })
  );
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? (input.kind === "void" ? "إلغاء بيع" : "مرتجع بيع"),
    source: "refund",
    sourceId: reverseSourceId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postWasteJournal(input: {
  wasteId: string;
  storeId: string;
  cost: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildWasteJournalLines({ cost: input.cost });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `هالك ${input.wasteId.slice(0, 8)}`,
    source: "adjustment",
    sourceId: `waste:${input.wasteId}`,
    lines,
    createdBy: input.createdBy,
  });
}

/** Credit note: reverse sale amounts onto AR + restock COGS. */
export async function postCreditNoteJournal(input: {
  creditNoteId: string;
  storeId: string;
  total: number;
  tax: number;
  discount: number;
  cogs?: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = reverseBuiltLines(
    buildSaleJournalLines({
      total: input.total,
      tax: input.tax,
      discount: input.discount,
      payments: [{ method: "credit", amount: input.total }],
      cogs: input.cogs,
    })
  );
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `إشعار دائن ${input.creditNoteId.slice(0, 8)}`,
    source: "refund",
    sourceId: input.creditNoteId,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postPurchaseReturnJournal(input: {
  purchaseReturnId: string;
  storeId: string;
  total: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildPurchaseReturnJournalLines({ total: input.total });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `مرتجع مشتريات ${input.purchaseReturnId.slice(0, 8)}`,
    source: "adjustment",
    sourceId: `purchase_return:${input.purchaseReturnId}`,
    lines,
    createdBy: input.createdBy,
  });
}

export async function postStockCountJournal(input: {
  countId: string;
  storeId: string;
  inventoryDeltaValue: number;
  entryDate?: string;
  createdBy: string;
  memo?: string;
}): Promise<JournalEntryWithLines | null> {
  if (!(await glEnabled())) return null;
  const built = buildStockCountJournalLines({
    inventoryDeltaValue: input.inventoryDeltaValue,
  });
  if (built.length === 0) return null;
  const lines = await linesFromBuilt(built);
  return createAndPostAutoJournal({
    storeId: input.storeId,
    entryDate: entryDateFrom(input.entryDate),
    memo: input.memo ?? `فروقات جرد ${input.countId.slice(0, 8)}`,
    source: "adjustment",
    sourceId: `stock_count:${input.countId}`,
    lines,
    createdBy: input.createdBy,
  });
}

async function softFail<T>(
  label: string,
  fn: () => Promise<T>,
  context: SoftFailContext
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "فشل ترحيل القيد";
    console.error(`[gl-posting] ${label} failed`, error);
    try {
      await auditRepo.insertAuditLog({
        action: GL_POSTING_FAILED_ACTION,
        entityType: "gl_journal",
        entityId: context.entityId,
        storeId: context.storeId,
        metadata: {
          label,
          source: context.source,
          error: message,
        },
      });
    } catch (auditError) {
      console.error(`[gl-posting] audit write failed`, auditError);
    }
    return null;
  }
}

export function safePostSaleJournal(
  input: Parameters<typeof postSaleJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postSaleJournal", () => postSaleJournal(input), {
    storeId: input.storeId,
    entityId: input.orderId,
    source: "sale",
  });
}

export function safePostExpenseJournal(
  input: Parameters<typeof postExpenseJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postExpenseJournal", () => postExpenseJournal(input), {
    storeId: input.storeId,
    entityId: input.expenseId,
    source: "expense",
  });
}

export function safePostPurchaseJournal(
  input: Parameters<typeof postPurchaseJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postPurchaseJournal", () => postPurchaseJournal(input), {
    storeId: input.storeId,
    entityId: input.purchaseId,
    source: "purchase",
  });
}

export function safePostCustomsCertificateJournal(
  input: Parameters<typeof postCustomsCertificateJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "postCustomsCertificateJournal",
    () => postCustomsCertificateJournal(input),
    {
      storeId: input.storeId,
      entityId: input.costId,
      source: "customs_certificate",
    }
  );
}

export function safePostCustomerPaymentJournal(
  input: Parameters<typeof postCustomerPaymentJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "postCustomerPaymentJournal",
    () => postCustomerPaymentJournal(input),
    {
      storeId: input.storeId,
      entityId: input.paymentId,
      source: "customer_payment",
    }
  );
}

export function safePostSupplierPaymentJournal(
  input: Parameters<typeof postSupplierPaymentJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "postSupplierPaymentJournal",
    () => postSupplierPaymentJournal(input),
    {
      storeId: input.storeId,
      entityId: input.paymentId,
      source: "supplier_payment",
    }
  );
}

export function safePostSaleReversalJournal(
  input: Parameters<typeof postSaleReversalJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "postSaleReversalJournal",
    () => postSaleReversalJournal(input),
    {
      storeId: input.storeId,
      entityId: input.orderId,
      source: "refund",
    }
  );
}

export function safePostWasteJournal(
  input: Parameters<typeof postWasteJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postWasteJournal", () => postWasteJournal(input), {
    storeId: input.storeId,
    entityId: input.wasteId,
    source: "adjustment",
  });
}

export function safePostCreditNoteJournal(
  input: Parameters<typeof postCreditNoteJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postCreditNoteJournal", () => postCreditNoteJournal(input), {
    storeId: input.storeId,
    entityId: input.creditNoteId,
    source: "refund",
  });
}

export function safePostPurchaseReturnJournal(
  input: Parameters<typeof postPurchaseReturnJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "postPurchaseReturnJournal",
    () => postPurchaseReturnJournal(input),
    {
      storeId: input.storeId,
      entityId: input.purchaseReturnId,
      source: "adjustment",
    }
  );
}

export function safePostStockCountJournal(
  input: Parameters<typeof postStockCountJournal>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail("postStockCountJournal", () => postStockCountJournal(input), {
    storeId: input.storeId,
    entityId: input.countId,
    source: "adjustment",
  });
}

export function safeReversePostedBySource(
  input: Parameters<typeof reversePostedBySource>[0]
): Promise<JournalEntryWithLines | null> {
  return softFail(
    "reversePostedBySource",
    () => reversePostedBySource(input),
    {
      storeId: input.storeId,
      entityId: input.originalSourceId,
      source: input.reverseSource,
    }
  );
}
