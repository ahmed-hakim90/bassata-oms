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
          ? "Credit sale"
          : e.entry_type === "payment_received"
            ? "Payment received"
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
  const ledgerByCustomer = await Promise.all(
    customers.map(async (c) => {
      const entries = await accountRepo.listCustomerLedger(c.id);
      const debitEvents = entries
        .filter((e) => e.entry_type === "credit_sale" && e.debit > 0)
        .map((e) => ({ at: e.created_at, amount: e.debit }));
      const allocated = allocateBalanceToAgedDebits(c.account_balance, debitEvents);
      mergeBuckets(buckets, allocated.buckets);
      return {
        ...c,
        oldestCreditAt: allocated.oldestAt,
        daysOutstanding: allocated.daysOutstanding,
      };
    })
  );
  return {
    customers: ledgerByCustomer,
    buckets,
    total: sumBuckets(buckets),
  };
}
