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

  if (customers.length === 0) {
    return { rows, buckets, total: 0 };
  }

  const debitEvents = await accountRepo.listCreditSaleDebitsForCustomers(
    customers.map((c) => c.id)
  );
  const eventsByCustomer = new Map<string, { at: string; amount: number }[]>();
  for (const event of debitEvents) {
    const list = eventsByCustomer.get(event.customerId) ?? [];
    list.push({ at: event.at, amount: event.amount });
    eventsByCustomer.set(event.customerId, list);
  }

  for (const customer of customers) {
    const allocated = allocateBalanceToAgedDebits(
      customer.account_balance,
      eventsByCustomer.get(customer.id) ?? []
    );
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
 *
 * Uses 2 batch queries (purchases + payments) across stores — not per-store loops.
 */
async function buildSupplierAging(storeId?: string): Promise<AgingSideReport> {
  const stores = storeId
    ? [(await storeRepo.getStore(storeId))].filter(Boolean)
    : await storeRepo.listStores();
  const storeIds = stores.filter(Boolean).map((s) => s!.id);
  const suppliers = await purchaseRepo.listSuppliers();
  const buckets = emptyAgingBuckets();
  const bySupplier = new Map<
    string,
    { balance: number; invoices: { at: string; amount: number }[] }
  >();

  const OPENING_AS_OF = "1970-01-01T00:00:00.000Z";
  for (const supplier of suppliers) {
    if (supplier.opening_balance <= 0) continue;
    bySupplier.set(supplier.id, {
      balance: supplier.opening_balance,
      invoices: [{ at: OPENING_AS_OF, amount: supplier.opening_balance }],
    });
  }

  const [invoices, payments] = await Promise.all([
    purchaseRepo.listReceivedPurchasesForAging(storeIds),
    paymentRepo.listPaymentsForStores(storeIds),
  ]);

  const purchasedBySupplier = new Map<string, number>();
  const invoicesBySupplier = new Map<string, { at: string; amount: number }[]>();
  for (const inv of invoices) {
    purchasedBySupplier.set(
      inv.supplier_id,
      (purchasedBySupplier.get(inv.supplier_id) ?? 0) + inv.total
    );
    const list = invoicesBySupplier.get(inv.supplier_id) ?? [];
    list.push({ at: inv.received_at, amount: inv.total });
    invoicesBySupplier.set(inv.supplier_id, list);
  }

  const paidBySupplier = new Map<string, number>();
  for (const p of payments) {
    if (p.voided_at) continue;
    paidBySupplier.set(
      p.supplier_id,
      (paidBySupplier.get(p.supplier_id) ?? 0) + p.amount
    );
  }

  for (const supplier of suppliers) {
    const purchased = purchasedBySupplier.get(supplier.id) ?? 0;
    const paid = paidBySupplier.get(supplier.id) ?? 0;
    const storeNet = purchased - paid;
    const invList = invoicesBySupplier.get(supplier.id) ?? [];
    if (storeNet === 0 && invList.length === 0) continue;

    const existing = bySupplier.get(supplier.id) ?? { balance: 0, invoices: [] };
    existing.balance += storeNet;
    existing.invoices.push(...invList);
    bySupplier.set(supplier.id, existing);
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

/** Customer AR aging only — for CRM glance boards. */
export async function getCustomerAgingSide(): Promise<AgingSideReport> {
  return buildCustomerAging();
}

/** Supplier AP aging only — for suppliers glance boards. */
export async function getSupplierAgingSide(
  storeId?: string
): Promise<AgingSideReport> {
  return buildSupplierAging(storeId);
}
