"use server";

import { submitPublicOnlineOrder } from "@/modules/online-orders/services/online-order.service";
import type { PublicOnlineOrderInput } from "@/modules/online-orders/services/online-order.service";

export async function submitPublicOnlineOrderAction(input: PublicOnlineOrderInput) {
  return submitPublicOnlineOrder(input);
}
