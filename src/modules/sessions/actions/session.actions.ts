"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermissionOrRole } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { requirePosAccess, getPosAccessOrNull } from "@/lib/auth/pos-access";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";
import {
  closeSession,
  forceCloseSession,
  openSession,
  getSessionById,
} from "@/modules/sessions/services/session.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";

export async function openSessionAction(openingCash: number) {
  await requirePermissionOrRole("session_open", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  if (ctx.user.role === "cashier" && ctx.activeCashierId !== ctx.user.id) {
    throw new Error("Switch back to your account or sign in to open a session");
  }

  const session = await openSession({
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    deviceId: ctx.deviceId,
    openingCash,
  });

  revalidatePath("/sessions");
  revalidatePath("/pos");
  return session;
}

export async function closeSessionAction(input: {
  sessionId: string;
  actualCash: number;
  notes?: string;
}) {
  const user = await requireAuth();
  const existing = await getSessionById(input.sessionId);
  if (!existing) throw new Error("Session not found");

  const posCtx = await getPosAccessOrNull();
  const activeCashierId = posCtx?.activeCashierId ?? user.id;

  const canForceClose = await permissionRepo.hasPermission("session_force_close");
  const canClose =
    canForceClose ||
    (existing.cashier_id === activeCashierId &&
      (user.role !== "cashier" || activeCashierId === user.id));

  if (!canClose) throw new Error("You can only close your own session");

  await requirePermissionOrRole("session_close", ["owner", "manager", "cashier"]);

  const reconciliation = await calcExpectedCash(input.sessionId);
  const session = await closeSession({
    sessionId: input.sessionId,
    expectedCash: reconciliation.expectedCash,
    actualCash: input.actualCash,
    notes: input.notes,
    userId: user.id,
  });

  revalidatePath("/sessions");
  revalidatePath("/");
  revalidatePath("/pos");
  return session;
}

export async function forceCloseSessionAction(input: {
  sessionId: string;
  actualCash: number;
  closeReason: string;
  notes?: string;
}) {
  const user = await requireAuth();
  await requirePermissionOrRole("session_force_close", ["owner", "manager"]);
  const settings = await getSessionSettings();
  if (!settings.allow_manager_force_close) {
    throw new Error("Manager force close is disabled in settings");
  }
  if (!input.closeReason.trim()) {
    throw new Error("Close reason is required");
  }

  const existing = await getSessionById(input.sessionId);
  if (!existing) throw new Error("Session not found");
  if (existing.status !== "open") throw new Error("Session is already closed");

  const reconciliation = await calcExpectedCash(input.sessionId);
  const session = await forceCloseSession({
    sessionId: input.sessionId,
    expectedCash: reconciliation.expectedCash,
    actualCash: input.actualCash,
    closeReason: input.closeReason.trim(),
    notes: input.notes,
    userId: user.id,
  });

  revalidatePath("/sessions");
  revalidatePath("/");
  revalidatePath("/pos");
  return session;
}
