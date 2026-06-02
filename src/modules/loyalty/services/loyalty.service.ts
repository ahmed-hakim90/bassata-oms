import * as customerRepo from "@/lib/repositories/customer.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { LoyaltyLedgerEntry, LoyaltyRule } from "@/lib/types";

export async function getLoyaltyRule(): Promise<LoyaltyRule | null> {
  return customerRepo.getLoyaltyRule();
}

export async function updateLoyaltyRule(
  input: Partial<Pick<LoyaltyRule, "points_per_currency" | "redemption_rate" | "is_active">>,
  userId: string
): Promise<LoyaltyRule | null> {
  const rule = await customerRepo.getLoyaltyRule();
  if (!rule) return null;
  const updated = await customerRepo.updateLoyaltyRule(rule.id, input);
  if (updated) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "loyalty.rules_updated",
      entityType: "loyalty_rule",
      entityId: rule.id,
      metadata: { ...input },
    });
  }
  return updated;
}

export async function earnPoints(input: {
  customerId: string;
  orderId: string;
  orderTotal: number;
}): Promise<LoyaltyLedgerEntry | null> {
  const rule = await customerRepo.getLoyaltyRule();
  if (!rule?.is_active) return null;
  const points = Math.floor(input.orderTotal * rule.points_per_currency);
  if (points <= 0) return null;
  const balance = (await customerRepo.getLoyaltyBalance(input.customerId)) + points;
  return customerRepo.addLoyaltyEntry({
    customer_id: input.customerId,
    order_id: input.orderId,
    points_delta: points,
    balance_after: balance,
    reason: "Purchase",
  });
}

export async function redeemPoints(input: {
  customerId: string;
  points: number;
  reason: string;
  userId: string;
  storeId: string;
}): Promise<LoyaltyLedgerEntry> {
  await assertPeriodOpen(input.storeId);
  const balance = await customerRepo.getLoyaltyBalance(input.customerId);
  if (input.points > balance) throw new Error("Insufficient points");
  const entry = await customerRepo.addLoyaltyEntry({
    customer_id: input.customerId,
    order_id: null,
    points_delta: -input.points,
    balance_after: balance - input.points,
    reason: input.reason,
  });
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId: input.userId,
    action: "loyalty.redeemed",
    entityType: "customer",
    entityId: input.customerId,
    metadata: { points: input.points },
  });
  return entry;
}

export async function getCustomerLoyaltyBalance(customerId: string): Promise<number> {
  return customerRepo.getLoyaltyBalance(customerId);
}

export async function listLoyaltyHistory(customerId: string) {
  return customerRepo.listLoyaltyLedger(customerId);
}

export async function getLedger(limit = 50) {
  const { getDb } = await import("@/lib/repositories/client");
  const db = await getDb();
  const { data } = await db
    .from("loyalty_ledger")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    order_id: row.order_id,
    points_delta: row.points_delta,
    balance_after: row.balance_after,
    reason: row.reason,
    created_at: row.created_at,
  }));
}

export async function getLoyaltyStats() {
  const ledger = await getLedger(500);
  const totalIssued = ledger
    .filter((e) => e.points_delta > 0)
    .reduce((s, e) => s + e.points_delta, 0);
  const totalRedeemed = ledger
    .filter((e) => e.points_delta < 0)
    .reduce((s, e) => s + Math.abs(e.points_delta), 0);
  return {
    totalIssued,
    totalRedeemed,
    activeCustomers: new Set(ledger.map((e) => e.customer_id)).size,
  };
}
