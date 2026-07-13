import * as accountRepo from "@/lib/repositories/customer-account.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as paymentRepo from "@/lib/repositories/supplier-payment.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  allocateBalanceToAgedDebits,
  emptyAgingBuckets,
  mergeBuckets,
  sumBuckets,
  type AgingBuckets,
} from "@/modules/reports/lib/aging-buckets";

export interface AgingPartyRow {
  id: string;
  name: string;
  phone?: string;
  balance: number;
  daysOutstanding: number;
  oldestAt: string | null;
  buckets: AgingBuckets;
}

export interface AgingSideReport {
  rows: AgingPartyRow[];
  buckets: AgingBuckets;
  total: number;
}

export interface AgingReport {
  customers: AgingSideReport;
  suppliers: AgingSideReport;
}

async function buildCustomerAging(): Promise<AgingSideReport> {
  const customers = await accountRepo.listCustomersWithBalance();
  const buckets = emptyAgingBuckets();
  const rows: AgingPartyRow[] = [];

  for (const customer of customers) {
    const entries = await accountRepo.listCustomerLedger(customer.id);
    const debitEvents = entries
      .filter((e) => e.entry_type === "credit_sale" && e.debit > 0)
      .map((e) => ({ at: e.created_at, amount: e.debit }));
    const allocated = allocateBalanceToAgedDebits(customer.account_balance, debitEvents);
    mergeBuckets(buckets, allocated.buckets);
    rows.push({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      balance: customer.account_balance,
      daysOutstanding: allocated.daysOutstanding,
      oldestAt: allocated.oldestAt,
      buckets: allocated.buckets,
    });
  }

  rows.sort((a, b) => b.balance - a.balance);
  return { rows, buckets, total: sumBuckets(buckets) };
}

/**
 * Supplier AP aging basics: outstanding = opening_balance + received purchases − payments,
 * aged by unpaid invoice dates (oldest open first). Opening balance is org-level and
 * counted once (not per store).
 */
async function buildSupplierAging(storeId?: string): Promise<AgingSideReport> {
  const stores = storeId
    ? [(await storeRepo.getStore(storeId))].filter(Boolean)
    : await storeRepo.listStores();
  const suppliers = await purchaseRepo.listSuppliers();
  const buckets = emptyAgingBuckets();
  const bySupplier = new Map<
    string,
    { balance: number; invoices: { at: string; amount: number }[] }
  >();

  // Seed org-level opening balance once per supplier.
  const OPENING_AS_OF = "1970-01-01T00:00:00.000Z";
  for (const supplier of suppliers) {
    if (supplier.opening_balance <= 0) continue;
    bySupplier.set(supplier.id, {
      balance: supplier.opening_balance,
      invoices: [{ at: OPENING_AS_OF, amount: supplier.opening_balance }],
    });
  }

  for (const store of stores) {
    if (!store) continue;
    const invoices = await purchaseRepo.listPurchaseInvoicesForStore(store.id);
    const payments = await paymentRepo.listPaymentsForStore(store.id);

    for (const supplier of suppliers) {
      const supplierInvoices = invoices.filter(
        (i) => i.supplier_id === supplier.id && i.status === "received" && i.received_at
      );
      const supplierPayments = payments.filter(
        (p) => p.supplier_id === supplier.id && !p.voided_at
      );
      const purchased = supplierInvoices.reduce((s, i) => s + i.total, 0);
      const paid = supplierPayments.reduce((s, p) => s + p.amount, 0);
      const storeNet = purchased - paid;
      if (storeNet === 0 && supplierInvoices.length === 0) continue;

      const existing = bySupplier.get(supplier.id) ?? { balance: 0, invoices: [] };
      existing.balance += storeNet;
      for (const inv of supplierInvoices) {
        existing.invoices.push({ at: inv.received_at as string, amount: inv.total });
      }
      bySupplier.set(supplier.id, existing);
    }
  }

  const rows: AgingPartyRow[] = [];
  for (const supplier of suppliers) {
    const data = bySupplier.get(supplier.id);
    if (!data || data.balance <= 0) continue;
    const allocated = allocateBalanceToAgedDebits(data.balance, data.invoices);
    mergeBuckets(buckets, allocated.buckets);
    rows.push({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.contact_info || undefined,
      balance: data.balance,
      daysOutstanding: allocated.daysOutstanding,
      oldestAt: allocated.oldestAt,
      buckets: allocated.buckets,
    });
  }

  rows.sort((a, b) => b.balance - a.balance);
  return { rows, buckets, total: sumBuckets(buckets) };
}

export async function getAgingBasicsReport(options?: {
  storeId?: string;
}): Promise<AgingReport> {
  const [customers, suppliers] = await Promise.all([
    buildCustomerAging(),
    buildSupplierAging(options?.storeId),
  ]);
  return { customers, suppliers };
}
