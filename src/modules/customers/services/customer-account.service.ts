import * as accountRepo from "@/lib/repositories/customer-account.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type {
  CustomerStatement,
  CustomerStatementTransaction,
  PaymentMethod,
} from "@/lib/types";

export async function getCustomerStatement(
  customerId: string,
  options?: { from?: string; to?: string }
): Promise<CustomerStatement | null> {
  const customer = await customerRepo.getCustomer(customerId);
  if (!customer) return null;

  const entries = await accountRepo.listCustomerLedger(customerId);
  const baseOpeningBalance =
    customer.account_balance - entries.reduce((s, e) => s + e.debit - e.credit, 0);
  const openingBalance =
    baseOpeningBalance +
    entries
      .filter((e) => options?.from && e.created_at.slice(0, 10) < options.from)
      .reduce((s, e) => s + e.debit - e.credit, 0);
  const filtered = entries.filter((e) => {
    const day = e.created_at.slice(0, 10);
    if (options?.from && day < options.from) return false;
    if (options?.to && day > options.to) return false;
    return true;
  });

  let balance = openingBalance;
  const transactions: CustomerStatementTransaction[] = filtered.map((e) => {
    balance += e.debit - e.credit;
    return {
      id: e.id,
      at: e.created_at,
      type: e.entry_type,
      reference: e.reference,
      description:
        e.notes ||
        (e.entry_type === "credit_sale"
          ? "بيع آجل"
          : e.entry_type === "payment_received"
            ? "تحصيل"
            : e.entry_type === "refund"
              ? "مرتجع"
              : e.entry_type === "adjustment"
                ? "تسوية"
                : e.entry_type),
      debit: e.debit,
      credit: e.credit,
      balance,
    };
  });

  return {
    customerId: customer.id,
    customerName: customer.name,
    openingBalance,
    closingBalance: balance,
    transactions,
  };
}

export async function recordCustomerPayment(input: {
  storeId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  userId: string;
}): Promise<string> {
  if (input.paymentMethod === "credit") {
    throw new Error("لا يمكن تسجيل التحصيل كبيع آجل");
  }
  await assertPeriodOpen(input.storeId);
  const paymentId = await accountRepo.recordCustomerPaymentRpc({
    storeId: input.storeId,
    customerId: input.customerId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    notes: input.notes,
  });
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.userId,
    action: "customer.payment_received",
    entityType: "customer_payment",
    entityId: paymentId,
    metadata: { customerId: input.customerId, amount: input.amount },
  });
  const { safePostCustomerPaymentJournal } = await import(
    "@/modules/accounting/services/gl-posting.service"
  );
  await safePostCustomerPaymentJournal({
    paymentId,
    storeId: input.storeId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    createdBy: input.userId,
  });
  return paymentId;
}

export async function getOutstandingBalances() {
  return accountRepo.listCustomersWithBalance();
}

export async function getAgingReport() {
  const customers = await accountRepo.listCustomersWithBalance();
  const { allocateBalanceToAgedDebits, emptyAgingBuckets, mergeBuckets, sumBuckets } =
    await import("@/modules/reports/lib/aging-buckets");
  const buckets = emptyAgingBuckets();

  if (customers.length === 0) {
    return { customers: [], buckets, total: 0 };
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

  const ledgerByCustomer = customers.map((c) => {
    const allocated = allocateBalanceToAgedDebits(
      c.account_balance,
      eventsByCustomer.get(c.id) ?? []
    );
    mergeBuckets(buckets, allocated.buckets);
    return {
      ...c,
      oldestCreditAt: allocated.oldestAt,
      daysOutstanding: allocated.daysOutstanding,
    };
  });

  return {
    customers: ledgerByCustomer,
    buckets,
    total: sumBuckets(buckets),
  };
}
