import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { PaymentMethod } from "@/lib/types";
import type {
  PurchaseInvoice,
  Supplier,
  SupplierListSummary,
  SupplierPayment,
  SupplierStatement,
  SupplierStatementTransaction,
  SupplierStatementTransactionType,
} from "@/lib/types";

type RawEvent = {
  at: string;
  sortOrder: number;
  type: SupplierStatementTransactionType;
  id: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  purchaseInvoiceId?: string;
};

const EVENT_SORT: Record<SupplierStatementTransactionType, number> = {
  purchase: 1,
  payment: 2,
  purchase_void: 3,
  payment_void: 4,
  purchase_return: 5,
};

function startOfDay(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getTime();
}

function endOfDay(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999Z`).getTime();
}

function eventImpact(e: RawEvent): number {
  return e.debit - e.credit;
}

function buildEventsFromInvoices(invoices: PurchaseInvoice[]): RawEvent[] {
  const events: RawEvent[] = [];
  for (const inv of invoices) {
    const kind = inv.document_kind ?? "purchase_invoice";
    if (kind === "purchase_return" && inv.status === "posted" && inv.received_at) {
      events.push({
        at: inv.received_at,
        sortOrder: EVENT_SORT.purchase_return,
        type: "purchase_return",
        id: inv.id,
        reference: inv.invoice_number,
        description: `مرتجع مشتريات ${inv.invoice_number}`,
        debit: 0,
        credit: inv.total,
        purchaseInvoiceId: inv.id,
      });
      continue;
    }
    if (kind !== "purchase_invoice") continue;
    if (inv.received_at) {
      events.push({
        at: inv.received_at,
        sortOrder: EVENT_SORT.purchase,
        type: "purchase",
        id: inv.id,
        reference: inv.invoice_number,
        description: `Purchase invoice ${inv.invoice_number}`,
        debit: inv.total,
        credit: 0,
        purchaseInvoiceId: inv.id,
      });
    }
    if (inv.status === "cancelled" && inv.received_at) {
      const voidAt = inv.cancelled_at ?? inv.received_at;
      events.push({
        at: voidAt,
        sortOrder: EVENT_SORT.purchase_void,
        type: "purchase_void",
        id: `${inv.id}-void`,
        reference: inv.invoice_number,
        description: `Cancelled invoice ${inv.invoice_number}`,
        debit: 0,
        credit: inv.total,
        purchaseInvoiceId: inv.id,
      });
    }
  }
  return events;
}

function buildEventsFromPayments(payments: SupplierPayment[]): RawEvent[] {
  const events: RawEvent[] = [];
  for (const p of payments) {
    events.push({
      at: p.paid_at,
      sortOrder: EVENT_SORT.payment,
      type: "payment",
      id: p.id,
      reference: p.reference || p.id.slice(0, 8),
      description: `Payment (${p.payment_method})`,
      debit: 0,
      credit: p.amount,
    });
    if (p.voided_at) {
      events.push({
        at: p.voided_at,
        sortOrder: EVENT_SORT.payment_void,
        type: "payment_void",
        id: `${p.id}-void`,
        reference: p.reference || p.id.slice(0, 8),
        description: `Voided payment (${p.payment_method})`,
        debit: p.amount,
        credit: 0,
      });
    }
  }
  return events;
}

function sortEvents(events: RawEvent[]): RawEvent[] {
  return [...events].sort((a, b) => {
    const t = new Date(a.at).getTime() - new Date(b.at).getTime();
    if (t !== 0) return t;
    return a.sortOrder - b.sortOrder;
  });
}

function inPeriod(at: string, from?: string, to?: string): boolean {
  const ts = new Date(at).getTime();
  if (from && ts < startOfDay(from)) return false;
  if (to && ts > endOfDay(to)) return false;
  return true;
}

function beforePeriod(at: string, from?: string): boolean {
  if (!from) return false;
  return new Date(at).getTime() < startOfDay(from);
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveStatementRange(from?: string, to?: string): { from?: string; to?: string } {
  if (from && !to) return { from, to: todayDateString() };
  return { from, to };
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return purchaseRepo.getSupplier(id);
}

export async function listSupplierSummaries(storeId: string): Promise<SupplierListSummary[]> {
  const suppliers = await purchaseRepo.listSuppliers();
  const invoices = await purchaseRepo.listPurchaseInvoicesForStore(storeId);
  const payments = await paymentRepo.listPaymentsForStore(storeId);

  return suppliers.map((supplier) => {
    const supplierInvoices = invoices.filter((i) => i.supplier_id === supplier.id);
    const supplierPayments = payments.filter((p) => p.supplier_id === supplier.id);

    const totalPurchased = supplierInvoices
      .filter((i) => (i.document_kind ?? "purchase_invoice") === "purchase_invoice" && i.status === "received")
      .reduce((s, i) => s + i.total, 0);

    const totalReturned = supplierInvoices
      .filter((i) => i.document_kind === "purchase_return" && i.status === "posted")
      .reduce((s, i) => s + i.total, 0);

    const totalPaid = supplierPayments
      .filter((p) => !p.voided_at)
      .reduce((s, p) => s + p.amount, 0);

    const activityDates: string[] = [];
    for (const i of supplierInvoices) {
      if (i.received_at) activityDates.push(i.received_at);
      if (i.cancelled_at) activityDates.push(i.cancelled_at);
    }
    for (const p of supplierPayments) {
      activityDates.push(p.paid_at);
      if (p.voided_at) activityDates.push(p.voided_at);
    }

    const lastActivityAt =
      activityDates.length > 0
        ? activityDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

    return {
      ...supplier,
      totalPurchased,
      totalPaid,
      balanceDue: supplier.opening_balance + totalPurchased - totalReturned - totalPaid,
      invoiceCount: supplierInvoices.filter(
        (i) => (i.document_kind ?? "purchase_invoice") === "purchase_invoice" && i.status === "received"
      ).length,
      lastActivityAt,
    };
  });
}

export async function getSupplierStatement(
  supplierId: string,
  options: { storeId: string; from?: string; to?: string }
): Promise<SupplierStatement | null> {
  const supplier = await purchaseRepo.getSupplier(supplierId);
  if (!supplier) return null;

  const invoices = await purchaseRepo.listPurchaseInvoicesForStore(options.storeId, {
    supplierId,
  });
  const payments = await paymentRepo.listPaymentsForStore(options.storeId, { supplierId });

  const { from, to } = resolveStatementRange(options.from, options.to);

  const allEvents = sortEvents([
    ...buildEventsFromInvoices(invoices),
    ...buildEventsFromPayments(payments),
  ]);

  // Prior AP (org-level) always seeds the running balance for this store view.
  let openingBalance = supplier.opening_balance;
  if (from) {
    for (const e of allEvents) {
      if (beforePeriod(e.at, from)) {
        openingBalance += eventImpact(e);
      }
    }
  }

  const periodEvents = allEvents.filter((e) => inPeriod(e.at, from, to));

  let running = openingBalance;
  const transactions: SupplierStatementTransaction[] = periodEvents.map((e) => {
    running += eventImpact(e);
    return {
      id: e.id,
      at: e.at,
      type: e.type,
      reference: e.reference,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance: running,
      purchaseInvoiceId: e.purchaseInvoiceId,
    };
  });

  const closingBalance = running;

  return {
    supplier,
    openingBalance,
    transactions,
    closingBalance,
  };
}

export async function createSupplierPayment(input: {
  storeId: string;
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  paidAt?: string;
  createdBy: string;
  /** When set (POS), links payment to session; cash reduces expected drawer cash. */
  sessionId?: string | null;
  /** Cash paid from HQ/store treasury (not session drawer). */
  treasuryId?: string | null;
  /** Skip GL when purchase receive already posts paid portion. */
  skipGlPost?: boolean;
}): Promise<SupplierPayment> {
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");
  if (input.paymentMethod === "credit") {
    throw new Error("Cannot record a supplier payment as credit");
  }
  if (input.treasuryId && input.sessionId) {
    throw new Error("سداد المورد من الجلسة بيتخصم من الدرج — متختارش خزينة");
  }
  if (input.treasuryId && input.paymentMethod !== "cash") {
    throw new Error("صرف المورد من الخزينة للنقدي فقط");
  }

  const supplier = await purchaseRepo.getSupplier(input.supplierId);
  if (!supplier) throw new Error("Supplier not found");

  await assertPeriodOpen(input.storeId);

  const sessionId: string | null = input.sessionId ?? null;
  if (sessionId) {
    const session = await sessionRepo.getSession(sessionId);
    if (!session) throw new Error("الجلسة غير موجودة");
    if (session.store_id !== input.storeId) {
      throw new Error("الجلسة لا تتبع الفرع الحالي");
    }
    if (session.status !== "open") {
      throw new Error("الجلسة مش مفتوحة");
    }
  }

  const payment = await paymentRepo.insertSupplierPayment({
    storeId: input.storeId,
    supplierId: input.supplierId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    notes: input.notes,
    paidAt: input.paidAt ?? new Date().toISOString(),
    createdBy: input.createdBy,
    sessionId,
    treasuryId: sessionId ? null : input.treasuryId ?? null,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "supplier_payment.created",
    entityType: "supplier_payment",
    entityId: payment.id,
    metadata: {
      amount: payment.amount,
      supplierId: input.supplierId,
      sessionId,
      paymentMethod: input.paymentMethod,
      treasuryId: input.treasuryId ?? null,
    },
  });

  if (!input.skipGlPost) {
    const { safePostSupplierPaymentJournal } = await import(
      "@/modules/accounting/services/gl-posting.service"
    );
    await safePostSupplierPaymentJournal({
      paymentId: payment.id,
      storeId: input.storeId,
      amount: payment.amount,
      paymentMethod: input.paymentMethod,
      entryDate: payment.paid_at,
      createdBy: input.createdBy,
    });
  }

  if (input.treasuryId && input.paymentMethod === "cash" && !sessionId) {
    const { postSupplierPayToTreasury } = await import(
      "@/modules/treasury/services/treasury.service"
    );
    await postSupplierPayToTreasury({
      treasuryId: input.treasuryId,
      supplierPaymentId: payment.id,
      amount: payment.amount,
    });
  }

  return payment;
}

export async function voidSupplierPayment(
  paymentId: string,
  userId: string
): Promise<SupplierPayment> {
  const existing = await paymentRepo.getSupplierPayment(paymentId);
  if (!existing) throw new Error("Payment not found");
  if (existing.voided_at) throw new Error("Payment already voided");

  await assertPeriodOpen(existing.store_id);

  const { reverseSupplierPayFromTreasury } = await import(
    "@/modules/treasury/services/treasury.service"
  );
  await reverseSupplierPayFromTreasury(paymentId);

  const payment = await paymentRepo.voidSupplierPayment(paymentId);
  if (!payment) throw new Error("Failed to void payment");

  const { safeReversePostedBySource } = await import(
    "@/modules/accounting/services/gl-posting.service"
  );
  await safeReversePostedBySource({
    originalSource: "supplier_payment",
    originalSourceId: paymentId,
    reverseSource: "adjustment",
    reverseSourceId: `supplier-payment-void:${paymentId}`,
    storeId: existing.store_id,
    createdBy: userId,
    memo: "عكس دفعة مورد ملغاة",
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: existing.store_id,
    userId,
    action: "supplier_payment.voided",
    entityType: "supplier_payment",
    entityId: paymentId,
    metadata: { amount: existing.amount, supplierId: existing.supplier_id },
  });

  return payment;
}
