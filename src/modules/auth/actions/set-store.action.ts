"use server";

import { revalidatePath } from "next/cache";
import { requireStoreAccess, setActiveStoreCookie } from "@/lib/auth/guards";

export async function setActiveStoreAction(storeId: string) {
  await requireStoreAccess(storeId);
  await setActiveStoreCookie(storeId);
  revalidatePath("/", "layout");
}
