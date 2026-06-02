"use server";

import { submitPublicOrder } from "@/modules/online-menu/services/public-menu.service";

export async function submitPublicOrderAction(input: {
  token: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  lines: { productId: string; variantId?: string | null; quantity: number }[];
}) {
  return submitPublicOrder(input);
}
