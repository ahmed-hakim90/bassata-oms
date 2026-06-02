import * as sessionRepo from "@/lib/repositories/session.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { CashierSession } from "@/lib/types";

export async function listSessions(storeId?: string): Promise<CashierSession[]> {
  return sessionRepo.listSessions(storeId);
}

export async function listOpenSessions(storeId?: string): Promise<CashierSession[]> {
  return sessionRepo.listOpenSessions(storeId);
}

export async function getActiveSession(
  storeId: string,
  cashierId?: string | null
): Promise<CashierSession | null> {
  return sessionRepo.getActiveSession(storeId, cashierId);
}

export async function openSession(input: {
  storeId: string;
  cashierId: string;
  deviceId: string;
  openingCash: number;
}): Promise<CashierSession> {
  await assertPeriodOpen(input.storeId);
  const session = await sessionRepo.openSession(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.cashierId,
    action: "session.opened",
    entityType: "cashier_session",
    entityId: session.id,
  });
  return session;
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
