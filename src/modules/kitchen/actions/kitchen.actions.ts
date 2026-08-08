"use server";

import { revalidatePath } from "next/cache";
import {
  advanceKitchenStatus,
  listKitchenTickets,
  type KitchenStatus,
  type KitchenTicket,
} from "@/modules/kitchen/services/kitchen.service";

export async function listKitchenTicketsAction(
  storeId?: string
): Promise<KitchenTicket[]> {
  return listKitchenTickets(storeId);
}

export async function advanceKitchenStatusAction(
  orderId: string,
  next: KitchenStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await advanceKitchenStatus(orderId, next);
    revalidatePath("/kitchen");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث حالة المطبخ",
    };
  }
}
