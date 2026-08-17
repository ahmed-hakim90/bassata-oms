"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole, requireStoreAccess } from "@/lib/auth/guards";
import {
  loadTreasuryPageData,
  listTreasuryOptions,
  sweepClosedPeriodToHq,
  transferBetweenTreasuries,
} from "@/modules/treasury/services/treasury.service";
import type { CashTreasuryEntryType } from "@/lib/types";

export async function getTreasuryPageDataAction(filters?: {
  treasuryId?: string;
  entryType?: CashTreasuryEntryType;
  from?: string;
  to?: string;
}) {
  await requirePermissionOrRole(["owner", "manager"]);
  return loadTreasuryPageData(filters);
}

export async function listTreasuryOptionsAction() {
  await requirePermissionOrRole(["owner", "manager", "cashier"]);
  return listTreasuryOptions();
}

export async function transferTreasuryAction(input: {
  fromTreasuryId: string;
  toTreasuryId: string;
  amount: number;
  notes?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermissionOrRole(["owner", "manager"]);
    await transferBetweenTreasuries(input);
    revalidatePath("/treasury");
    revalidatePath("/sessions");
    revalidatePath("/accounting");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر التحويل بين الخزائن",
    };
  }
}

export async function sweepPeriodToHqAction(input: {
  storeId: string;
  periodId: string;
  notes?: string;
}): Promise<{ success: true; amount: number } | { success: false; error: string }> {
  try {
    await requirePermissionOrRole(["owner", "manager"]);
    await requireStoreAccess(input.storeId);
    const amount = await sweepClosedPeriodToHq(input);
    revalidatePath("/treasury");
    revalidatePath("/sessions");
    revalidatePath("/monthly-closing");
    return { success: true, amount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر سحب الفترة للخزينة الرئيسية",
    };
  }
}
