import * as vaultRepo from "@/lib/repositories/cashier-vault.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { CashierVault } from "@/lib/types";

export type CashierVaultSummary = {
  cashierId: string;
  cashierName: string;
  role: string;
  balance: number;
  pendingOpeningFloat: number;
  vaultId: string | null;
  updatedAt: string | null;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Virtual zero vault when no row exists yet. */
export function emptyVaultView(storeId: string, cashierId: string): CashierVault {
  return {
    id: "",
    org_id: "",
    store_id: storeId,
    cashier_id: cashierId,
    balance: 0,
    pending_opening_float: 0,
    created_at: "",
    updated_at: "",
  };
}

export async function getCashierVault(
  storeId: string,
  cashierId: string
): Promise<CashierVault> {
  const vault = await vaultRepo.getVault(storeId, cashierId);
  return vault ?? emptyVaultView(storeId, cashierId);
}

export async function listStoreCashierVaults(storeId: string): Promise<CashierVaultSummary[]> {
  const [users, vaults] = await Promise.all([
    userRepo.listUsers(),
    vaultRepo.listVaultsByStore(storeId),
  ]);
  const vaultByCashier = new Map(vaults.map((v) => [v.cashier_id, v]));

  const cashiers = users.filter(
    (u) =>
      u.is_active &&
      (u.role === "cashier" || u.role === "manager" || u.role === "owner") &&
      (u.role === "owner" || u.store_ids.includes(storeId) || vaultByCashier.has(u.id))
  );

  const rows: CashierVaultSummary[] = cashiers.map((u) => {
    const vault = vaultByCashier.get(u.id);
    return {
      cashierId: u.id,
      cashierName: u.name,
      role: u.role,
      balance: vault?.balance ?? 0,
      pendingOpeningFloat: vault?.pending_opening_float ?? 0,
      vaultId: vault?.id ?? null,
      updatedAt: vault?.updated_at ?? null,
    };
  });

  // Include vaults for inactive/removed cashiers that still hold balance.
  for (const vault of vaults) {
    if (rows.some((r) => r.cashierId === vault.cashier_id)) continue;
    const user = users.find((u) => u.id === vault.cashier_id);
    rows.push({
      cashierId: vault.cashier_id,
      cashierName: user?.name ?? "كاشير غير نشط",
      role: user?.role ?? "cashier",
      balance: vault.balance,
      pendingOpeningFloat: vault.pending_opening_float,
      vaultId: vault.id,
      updatedAt: vault.updated_at,
    });
  }

  return rows.sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return a.cashierName.localeCompare(b.cashierName, "ar");
  });
}

/** Float that will open the next session for this cashier (locked for cashiers). */
export async function getPendingOpeningFloat(
  storeId: string,
  cashierId: string
): Promise<number> {
  const vault = await getCashierVault(storeId, cashierId);
  return vault.pending_opening_float;
}

export async function takeOpeningFloatFromVault(input: {
  storeId: string;
  cashierId: string;
  amount: number;
}): Promise<CashierVault> {
  await assertPeriodOpen(input.storeId);
  const amount = money(input.amount);
  if (amount < 0) throw new Error("رصيد بداية الوردية لازم يكون صفر أو أكبر");
  return vaultRepo.takeOpeningFloat({
    storeId: input.storeId,
    cashierId: input.cashierId,
    amount,
  });
}

export async function depositClosingCashToVault(input: {
  storeId: string;
  cashierId: string;
  amount: number;
  sessionId: string;
}): Promise<CashierVault> {
  const amount = money(input.amount);
  if (amount < 0) throw new Error("مبلغ تسليم الدرج لازم يكون صفر أو أكبر");
  return vaultRepo.depositClosing({
    storeId: input.storeId,
    cashierId: input.cashierId,
    amount,
    sessionId: input.sessionId,
  });
}

export async function withdrawFromCashierVault(input: {
  storeId: string;
  cashierId: string;
  withdrawAmount: number;
  nextOpeningFloat: number;
  notes?: string;
}): Promise<CashierVault> {
  await assertPeriodOpen(input.storeId);
  const withdrawAmount = money(input.withdrawAmount);
  const nextOpeningFloat = money(input.nextOpeningFloat);
  if (withdrawAmount < 0 || nextOpeningFloat < 0) {
    throw new Error("المبالغ يجب تكون صفر أو أكبر");
  }
  const vault = await getCashierVault(input.storeId, input.cashierId);
  if (withdrawAmount + nextOpeningFloat > vault.balance + 1e-9) {
    throw new Error("السحب + رصيد بداية الوردية الجاية أكبر من رصيد الخزينة");
  }
  return vaultRepo.adminWithdraw({
    storeId: input.storeId,
    cashierId: input.cashierId,
    withdrawAmount,
    nextOpeningFloat,
    notes: input.notes,
  });
}

export type BatchVaultWithdrawItem = {
  cashierId: string;
  cashierName: string;
  withdrawAmount: number;
  nextOpeningFloat: number;
  ok: boolean;
  error?: string;
};

export type BatchVaultWithdrawResult = {
  withdrawnTotal: number;
  attempted: number;
  succeeded: number;
  failed: number;
  items: BatchVaultWithdrawItem[];
};

export type BatchVaultWithdrawRequestItem = {
  cashierId: string;
  withdrawAmount: number;
};

/** Withdraw requested amounts; keeps each cashier's pending opening float. */
export async function batchWithdrawStoreCashierVaults(input: {
  storeId: string;
  notes?: string;
  /** If omitted, withdraws the full excess above pending float for every vault. */
  items?: BatchVaultWithdrawRequestItem[];
}): Promise<BatchVaultWithdrawResult> {
  await assertPeriodOpen(input.storeId);
  const rows = await listStoreCashierVaults(input.storeId);
  const rowByCashier = new Map(rows.map((row) => [row.cashierId, row]));
  const note =
    input.notes?.trim() ||
    "سحب من خزائن الكاشير (مع الإبقاء على رصيد بداية الوردية)";

  const requested: BatchVaultWithdrawRequestItem[] =
    input.items && input.items.length > 0
      ? input.items
      : rows.map((row) => {
          const nextOpeningFloat = money(
            Math.min(row.pendingOpeningFloat, row.balance)
          );
          return {
            cashierId: row.cashierId,
            withdrawAmount: money(row.balance - nextOpeningFloat),
          };
        });

  const items: BatchVaultWithdrawItem[] = [];
  let withdrawnTotal = 0;
  let succeeded = 0;
  let failed = 0;

  for (const req of requested) {
    const row = rowByCashier.get(req.cashierId);
    if (!row) {
      failed += 1;
      items.push({
        cashierId: req.cashierId,
        cashierName: "كاشير غير معروف",
        withdrawAmount: money(req.withdrawAmount),
        nextOpeningFloat: 0,
        ok: false,
        error: "الكاشير مش موجود على خزائن الفرع",
      });
      continue;
    }

    const nextOpeningFloat = money(Math.min(row.pendingOpeningFloat, row.balance));
    const maxWithdraw = money(row.balance - nextOpeningFloat);
    const withdrawAmount = money(req.withdrawAmount);

    if (withdrawAmount <= 1e-9) continue;

    if (withdrawAmount > maxWithdraw + 1e-9) {
      failed += 1;
      items.push({
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        withdrawAmount,
        nextOpeningFloat,
        ok: false,
        error: `أقصى سحب متاح ${maxWithdraw}`,
      });
      continue;
    }

    try {
      await vaultRepo.adminWithdraw({
        storeId: input.storeId,
        cashierId: row.cashierId,
        withdrawAmount,
        nextOpeningFloat,
        notes: note,
      });
      withdrawnTotal = money(withdrawnTotal + withdrawAmount);
      succeeded += 1;
      items.push({
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        withdrawAmount,
        nextOpeningFloat,
        ok: true,
      });
    } catch (error) {
      failed += 1;
      items.push({
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        withdrawAmount,
        nextOpeningFloat,
        ok: false,
        error: error instanceof Error ? error.message : "تعذر السحب",
      });
    }
  }

  if (items.length === 0) {
    throw new Error("حدد مبلغ سحب أكبر من صفر لخزينة واحدة على الأقل");
  }

  return {
    withdrawnTotal,
    attempted: items.length,
    succeeded,
    failed,
    items,
  };
}
