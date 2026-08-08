"use server";

import { revalidatePath } from "next/cache";
import {
  loginCashierWithPin,
  preparePosPinLoginContext,
  type PosPinLoginContext,
} from "@/modules/auth/services/pos-pin-login.service";

export async function preparePosPinLoginAction(input?: {
  storeId?: string | null;
  storeSlug?: string | null;
}): Promise<PosPinLoginContext> {
  return preparePosPinLoginContext(input);
}

export async function loginWithPosPinAction(input: {
  pin: string;
  storeId?: string | null;
  storeSlug?: string | null;
}): Promise<{ success: boolean; error?: string; posPath?: string }> {
  const result = await loginCashierWithPin(input);
  if (!result.success) return result;
  revalidatePath(result.posPath);
  revalidatePath("/sessions");
  return { success: true, posPath: result.posPath };
}
