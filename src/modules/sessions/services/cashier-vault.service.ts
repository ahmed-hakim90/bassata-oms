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
