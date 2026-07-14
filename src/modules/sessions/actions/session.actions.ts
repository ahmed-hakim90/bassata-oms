"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermissionOrRole, requireStoreAccess } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { requirePosAccess, getPosAccessOrNull, PosAccessError } from "@/lib/auth/pos-access";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";
import {
  closeSession,
  forceCloseSession,
  openSession,
  getSessionById,
} from "@/modules/sessions/services/session.service";
import {
  batchWithdrawStoreCashierVaults,
  getCashierVault,
  getPendingOpeningFloat,
  withdrawFromCashierVault,
} from "@/modules/sessions/services/cashier-vault.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import { roundMoney } from "@/lib/money";

function mapPosAccessError(error: PosAccessError): string {
  const messages: Record<PosAccessError["code"], string> = {
    login_required: "سجّل الدخول أولاً",
    no_device: "اربط جهاز نقطة البيع من شاشة POS ثم أعد المحاولة",
    device_inactive: "الجهاز غير نشط — فعّله من الإعدادات",
    store_mismatch: "الجهاز لا يتبع الفرع الحالي — غيّر الفرع أو الجهاز",
    store_required: "اختر الفرع أولاً قبل فتح الجلسة",
    access_denied: "ليس لديك صلاحية على هذا الفرع",
    cashier_required: "حدد الكاشير النشط على الجهاز",
    role_denied: "دورك لا يسمح بفتح جلسة كاشير",
  };
  return messages[error.code] ?? error.message;
}

/**
 * Resolve opening float:
 * - Cashier (POS): locked to pending_opening_float (cannot invent float).
 * - Owner/manager: may pass openingCash, else falls back to pending.
 */
export async function resolveOpeningCashForOpen(input: {
  storeId: string;
  cashierId: string;
  role: string;
  requestedOpeningCash?: number | null;
}): Promise<number> {
  const vault = await getCashierVault(input.storeId, input.cashierId);
  const pending = vault.pending_opening_float;

  if (input.role === "cashier") {
    return pending;
  }

  if (input.requestedOpeningCash == null || Number.isNaN(input.requestedOpeningCash)) {
    return pending;
  }

  const requested = roundMoney(input.requestedOpeningCash);
  if (requested < 0) {
    throw new Error("رصيد بداية الوردية لازم يكون صفر أو أكبر");
  }
  if (requested > vault.balance + 1e-9) {
    throw new Error(
      `رصيد الخزينة (${vault.balance}) غير كافٍ لرصيد بداية الوردية المطلوب`
    );
  }
  return requested;
}

export async function openSessionAction(openingCash?: number | null) {
  await requirePermissionOrRole("session_open", ["owner", "manager", "cashier"]);
  let ctx;
  try {
    ctx = await requirePosAccess();
  } catch (error) {
    if (error instanceof PosAccessError) {
      throw new Error(mapPosAccessError(error));
    }
    throw new Error(error instanceof Error ? error.message : "تعذر فتح الجلسة");
  }
  if (ctx.user.role === "cashier" && ctx.activeCashierId !== ctx.user.id) {
    throw new Error("ارجع لحسابك أو سجّل دخولك لفتح الجلسة");
  }

  const resolvedOpeningCash = await resolveOpeningCashForOpen({
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    role: ctx.user.role,
    requestedOpeningCash: openingCash,
  });

  const session = await openSession({
    storeId: ctx.storeId,
    cashierId: ctx.activeCashierId,
    deviceId: ctx.deviceId,
    openingCash: resolvedOpeningCash,
  });

  revalidatePath("/sessions");
  // Avoid revalidatePath("/pos") mid-sale; POS clients call router.refresh when needed.
  return session;
}

/** POS quick-open: always uses locked pending float (or 0). */
export async function quickOpenSessionAction() {
  return openSessionAction(null);
}

export async function getPendingOpeningFloatAction(): Promise<{
  pendingOpeningFloat: number;
  vaultBalance: number;
}> {
  await requirePermissionOrRole("session_open", ["owner", "manager", "cashier"]);
  let ctx;
  try {
    ctx = await requirePosAccess();
  } catch (error) {
    if (error instanceof PosAccessError) {
      throw new Error(mapPosAccessError(error));
    }
    throw error;
  }
  const vault = await getCashierVault(ctx.storeId, ctx.activeCashierId);
  return {
    pendingOpeningFloat: vault.pending_opening_float,
    vaultBalance: vault.balance,
  };
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
  return session;
}

export async function withdrawCashierVaultAction(input: {
  storeId: string;
  cashierId: string;
  withdrawAmount: number;
  nextOpeningFloat: number;
  notes?: string;
}) {
  await requirePermissionOrRole(["owner", "manager"]);
  await requireStoreAccess(input.storeId);

  const vault = await withdrawFromCashierVault({
    storeId: input.storeId,
    cashierId: input.cashierId,
    withdrawAmount: input.withdrawAmount,
    nextOpeningFloat: input.nextOpeningFloat,
    notes: input.notes,
  });

  revalidatePath("/sessions");
  return vault;
}

export async function batchWithdrawCashierVaultsAction(input: {
  storeId: string;
  notes?: string;
  items?: Array<{ cashierId: string; withdrawAmount: number }>;
}) {
  await requirePermissionOrRole(["owner", "manager"]);
  await requireStoreAccess(input.storeId);

  const result = await batchWithdrawStoreCashierVaults({
    storeId: input.storeId,
    notes: input.notes,
    items: input.items,
  });

  revalidatePath("/sessions");
  return result;
}

export async function getCashierPendingFloatPreviewAction(storeId: string, cashierId: string) {
  await requireAuth();
  await requireStoreAccess(storeId);
  return getPendingOpeningFloat(storeId, cashierId);
}
