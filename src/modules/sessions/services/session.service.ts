import * as sessionRepo from "@/lib/repositories/session.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import * as vaultRepo from "@/lib/repositories/cashier-vault.repository";
import { takeOpeningFloatFromVault } from "@/modules/sessions/services/cashier-vault.service";
import type { CashierSession } from "@/lib/types";
import { cache } from "react";
import { roundMoney } from "@/lib/money";

export async function listSessions(storeId?: string): Promise<CashierSession[]> {
  return sessionRepo.listSessions(storeId);
}

export async function listOpenSessions(storeId?: string): Promise<CashierSession[]> {
  return sessionRepo.listOpenSessions(storeId);
}

/** Deduped per request — POS readiness + page share one lookup. */
export const getActiveSession = cache(
  async (storeId: string, cashierId?: string | null): Promise<CashierSession | null> => {
    return sessionRepo.getActiveSession(storeId, cashierId ?? null);
  }
);

export async function openSession(input: {
  storeId: string;
  cashierId: string;
  deviceId: string;
  openingCash: number;
}): Promise<CashierSession> {
  await assertPeriodOpen(input.storeId);

  const existing = await sessionRepo.getActiveSession(input.storeId, input.cashierId);
  if (existing) return existing;

  const openingCash = roundMoney(input.openingCash);
  if (openingCash < 0) {
    throw new Error("رصيد بداية الوردية لازم يكون صفر أو أكبر");
  }

  // Drawer float leaves vault (amanah → درج). Pending float is cleared inside the RPC.
  await takeOpeningFloatFromVault({
    storeId: input.storeId,
    cashierId: input.cashierId,
    amount: openingCash,
  });

  try {
    const { session, created } = await sessionRepo.openSession({
      ...input,
      openingCash,
    });

    if (!created) {
      if (openingCash > 0) {
        await vaultRepo.refundOpeningFloat({
          storeId: input.storeId,
          cashierId: input.cashierId,
          amount: openingCash,
        });
      }
      return session;
    }

    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: input.storeId,
      userId: input.cashierId,
      action: "session.opened",
      entityType: "cashier_session",
      entityId: session.id,
      metadata: { opening_cash: openingCash },
    });
    return session;
  } catch (error) {
    if (openingCash > 0) {
      try {
        await vaultRepo.refundOpeningFloat({
          storeId: input.storeId,
          cashierId: input.cashierId,
          amount: openingCash,
        });
      } catch {
        // Surface original open failure; vault reverse may need ops follow-up.
      }
    }
    throw error;
  }
}

export async function closeSession(input: {
  sessionId: string;
  expectedCash: number;
  actualCash: number;
  notes?: string;
  userId: string;
  closedBy?: string;
  closeReason?: string;
  forceClosed?: boolean;
}): Promise<CashierSession | null> {
  const existing = await sessionRepo.getSession(input.sessionId);
  if (!existing) return null;
  await assertPeriodOpen(existing.store_id);
  const session = await sessionRepo.closeSession({
    sessionId: input.sessionId,
    expectedCash: input.expectedCash,
    actualCash: input.actualCash,
    notes: input.notes,
    closedBy: input.closedBy ?? input.userId,
    closeReason: input.closeReason,
    forceClosed: input.forceClosed,
  });
  if (session) {
    // Full counted drawer settles into cashier vault (درج → خزينة).
    await vaultRepo.depositClosing({
      storeId: session.store_id,
      cashierId: session.cashier_id,
      amount: input.actualCash,
      sessionId: session.id,
    });

    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: session.store_id,
      userId: input.userId,
      action: input.forceClosed ? "session.force_closed" : "session.closed",
      entityType: "cashier_session",
      entityId: session.id,
      metadata: {
        variance: session.variance,
        close_reason: input.closeReason ?? null,
        force_closed: input.forceClosed ?? false,
        vault_deposit: input.actualCash,
      },
    });
  }
  return session;
}

export async function forceCloseSession(input: {
  sessionId: string;
  expectedCash: number;
  actualCash: number;
  closeReason: string;
  notes?: string;
  userId: string;
}): Promise<CashierSession | null> {
  return closeSession({
    ...input,
    forceClosed: true,
    closedBy: input.userId,
  });
}

export async function getSessionById(sessionId: string): Promise<CashierSession | null> {
  return sessionRepo.getSession(sessionId);
}
