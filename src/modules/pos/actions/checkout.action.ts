"use server";

import {
  executePosCheckout,
  type CheckoutFlowInput,
  type CheckoutFlowResult,
} from "@/modules/pos/services/pos-checkout-flow.service";

export type CheckoutActionResult = CheckoutFlowResult;

/** @deprecated Prefer POST /api/pos/checkout from the POS client to avoid RSC remount. */
export async function checkoutAction(input: CheckoutFlowInput): Promise<CheckoutActionResult> {
  return executePosCheckout(input);
}
