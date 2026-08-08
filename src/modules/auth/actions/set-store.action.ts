"use server";

import { revalidatePath } from "next/cache";
import { requireStoreAccess, setActiveStoreCookie } from "@/lib/auth/guards";
import { setActiveCashierId } from "@/lib/auth/session";

export async function setActiveStoreAction(storeId: string) {
  const user = await requireStoreAccess(storeId);
  await setActiveStoreCookie(storeId);
  // Store change locks the register — cashier must enter PIN again.
  await setActiveCashierId(null);
  try {
    const { ensureImplicitPosDeviceBinding } = await import("@/lib/auth/implicit-pos-device");
    await ensureImplicitPosDeviceBinding(user, { storeId });
  } catch {
    // POS binder is best-effort; /pos will retry.
  }
  revalidatePath("/", "layout");
  revalidatePath("/pos");
}
